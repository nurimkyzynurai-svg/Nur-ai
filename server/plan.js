import { planImproverAgent, ANY_PLATFORM, GOALS } from '../src/agents/index.js'
import { friendlyError } from './claude.js'
import { emptyUsage } from './cost.js'
import { briefSummary, ensureBrand, ensureMarketBrief, generationCost, logGeneration, makeStepper, produceContent } from './director.js'

export const MAX_PLAN_DAYS = 31
const FOLLOW_UP_DAYS = 14 // the plan may run this many days past the key date
const DAY_CONCURRENCY = 2 // plan days produced in parallel

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (s) => typeof s === 'string' && DATE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())
const addDays = (date, n) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Validates and cleans a plan from the browser. Throws an Error with a client-friendly message. */
export function cleanPlan(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Plan is missing.')
  const plan = {
    name: text(raw.name, 120),
    campaignGoal: text(raw.campaignGoal, 300),
    startDate: raw.startDate,
    keyDate: raw.keyDate,
    keyDateLabel: text(raw.keyDateLabel, 120),
    vision: text(raw.vision, 4000),
    notes: text(raw.notes, 4000),
    days: [],
  }
  if (!plan.name) throw new Error('Give the campaign a name.')
  if (!plan.campaignGoal) throw new Error('Describe the campaign goal.')
  if (!isDate(plan.startDate) || !isDate(plan.keyDate)) throw new Error('Start date and key date must be valid dates.')
  if (plan.keyDate < plan.startDate) throw new Error('The key date must be on or after the start date.')
  if (!Array.isArray(raw.days)) throw new Error('Add at least one day.')

  const seen = new Set()
  for (const d of raw.days) {
    const content = text(d?.content, 2000)
    if (!content) continue
    if (!isDate(d.date)) throw new Error(`“${content.slice(0, 40)}” needs a valid date.`)
    if (seen.has(d.date)) throw new Error(`There are two items on ${d.date}. Keep one item per day.`)
    seen.add(d.date)
    plan.days.push({ date: d.date, content, platform: text(d.platform, 40), format: text(d.format, 60), locked: Boolean(d.locked), phase: text(d.phase, 40) })
  }
  if (!plan.days.length) throw new Error('Add at least one day with content.')
  if (plan.days.length > MAX_PLAN_DAYS) throw new Error(`A plan can have at most ${MAX_PLAN_DAYS} days.`)
  plan.days.sort((a, b) => a.date.localeCompare(b.date))
  return plan
}

export function planWindow(plan) {
  const lastDay = plan.days[plan.days.length - 1].date
  const end = addDays(plan.keyDate, FOLLOW_UP_DAYS)
  return { from: plan.startDate < plan.days[0].date ? plan.startDate : plan.days[0].date, to: lastDay > end ? lastDay : end }
}

/**
 * Enforces the "respect the client" rules on the Creative Director's improved plan, in code:
 * locked days come back exactly as written, dates stay in the window, one item per date,
 * at most MAX_PLAN_DAYS, and the change labels are recomputed from the real differences.
 */
export function normalizeImproved(plan, improved) {
  const window = planWindow(plan)
  const original = new Map(plan.days.map((d) => [d.date, d]))
  const days = new Map()
  const notes = []

  for (const d of improved.days) {
    if (!isDate(d.date) || d.date < window.from || d.date > window.to) {
      notes.push(`Dropped an item dated “${d.date}” — outside the campaign window.`)
      continue
    }
    if (days.has(d.date)) {
      notes.push(`Dropped a second item on ${d.date} — one item per day.`)
      continue
    }
    days.set(d.date, { ...d, content: text(d.content, 2000) })
  }

  // Locked days always come back exactly as the client wrote them.
  for (const o of plan.days.filter((d) => d.locked)) {
    const existing = days.get(o.date)
    days.set(o.date, {
      date: o.date,
      content: o.content,
      format: o.format,
      platform: o.platform,
      phase: existing?.phase || '',
      change: 'kept',
      original_date: '',
      reason: 'Locked by you — kept exactly as written.',
    })
  }

  let list = [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
  if (list.length > MAX_PLAN_DAYS) {
    notes.push(`Trimmed to ${MAX_PLAN_DAYS} days.`)
    const keep = new Set(list.filter((d) => original.has(d.date)).map((d) => d.date))
    list = [...list.filter((d) => keep.has(d.date)), ...list.filter((d) => !keep.has(d.date))].slice(0, MAX_PLAN_DAYS)
    list.sort((a, b) => a.date.localeCompare(b.date))
  }

  // Recompute what actually changed against the client's plan.
  const movedFrom = new Set()
  list = list.map((d) => {
    const o = original.get(d.date)
    let change
    if (o) change = o.content === d.content ? 'kept' : 'improved'
    else if (d.change === 'moved' && original.has(d.original_date)) {
      change = 'moved'
      movedFrom.add(d.original_date)
    } else change = 'new'
    return {
      date: d.date,
      content: d.content,
      format: d.format || o?.format || '',
      platform: d.platform || o?.platform || '',
      phase: d.phase || '',
      change,
      originalDate: change === 'moved' ? d.original_date : '',
      originalContent: change === 'improved' ? o.content : change === 'moved' ? original.get(d.original_date).content : '',
      reason: d.reason || '',
      locked: Boolean(o?.locked && change === 'kept'),
    }
  })

  const present = new Set(list.map((d) => d.date))
  const reasons = new Map(improved.removed.map((r) => [r.original_date, r.reason]))
  const removed = plan.days
    .filter((o) => !present.has(o.date) && !movedFrom.has(o.date))
    .map((o) => ({ date: o.date, content: o.content, reason: reasons.get(o.date) || 'Removed by the Creative Director.' }))

  return { strategySummary: improved.strategy_summary, phases: improved.phases, days: list, removed, notes }
}

/** "Improve it": the Creative Director improves the plan. Returns the proposal for the client to approve. */
export async function runPlanImprove({ plan, niche, nicheDescription, goal, language, platform, brandProfile, brandInputs }, emit, { signal } = {}) {
  const usage = emptyUsage()
  const { step, stats } = makeStepper(emit, { signal, usage })
  const profile = await ensureBrand({ niche: nicheDescription || niche, goal, language, brandProfile, brandInputs }, emit, { step })
  const market = await ensureMarketBrief({ niche, nicheDescription, platform, language }, emit)
  const window = planWindow(plan)
  const improved = await step(
    planImproverAgent,
    { brandProfile: profile, goal, language, niche, nicheDescription, platform, marketBrief: market.brief, plan, window },
    `Improving your ${plan.days.length}-day plan…`,
    (r) => `${r.days.length} days proposed`,
  )
  const cost = generationCost(usage, stats, [market.research])
  logGeneration(`plan improve] [${plan.name}`, cost)
  return {
    ...normalizeImproved(plan, improved),
    brandProfile: profile,
    marketBrief: briefSummary(market.brief),
    marketDataUnavailable: !market.brief,
    cost,
  }
}

/**
 * Produces every plan day: hooks → script ⇄ quality → market fit → captions, exactly as each day describes.
 * Each day uses the Market Brief for its own platform (one shared brief per niche + platform + language).
 * Emits { type: 'day', date, status: 'running' | 'done' | 'error', ... } for each day.
 */
export async function runPlanGenerate({ plan, niche, nicheDescription, goal, language, platform, brandProfile, brandInputs }, emit, { signal, onDayDone } = {}) {
  const usage = emptyUsage()
  const setup = makeStepper(emit, { signal, usage })
  const stats = setup.stats
  const profile = await ensureBrand({ niche: nicheDescription || niche, goal, language, brandProfile, brandInputs }, emit, setup)
  const campaign = { name: plan.name, campaignGoal: plan.campaignGoal, keyDate: plan.keyDate, keyDateLabel: plan.keyDateLabel, vision: plan.vision, notes: plan.notes }

  // One brief per distinct platform in the plan, fetched before the days start.
  const dayPlatform = (day) => day.platform || platform || ANY_PLATFORM
  const briefs = new Map()
  const research = []
  for (const p of [...new Set(plan.days.map(dayPlatform))]) {
    const market = await ensureMarketBrief({ niche, nicheDescription, platform: p, language }, emit)
    briefs.set(p, market.brief)
    research.push(market.research)
  }

  let done = 0
  let failed = 0
  const queue = [...plan.days]
  const worker = async () => {
    while (queue.length && !signal?.aborted) {
      const day = queue.shift()
      const dayUsage = emptyUsage()
      const dayStats = { agentCalls: 0 }
      const dayEmit = (evt) => evt.type === 'step' && emit({ type: 'day', date: day.date, status: 'running', detail: `${evt.name}: ${evt.detail}` })
      const { step, call } = makeStepper(dayEmit, { signal, usage: dayUsage, stats: dayStats })
      emit({ type: 'day', date: day.date, status: 'running', detail: 'Starting…' })
      try {
        const p = dayPlatform(day)
        const ctx = { brandProfile: profile, goal, language, niche, nicheDescription, platform: p, marketBrief: briefs.get(p), planDay: { campaign, day } }
        const idea = { title: day.content.split('\n')[0].slice(0, 100), plan_item: day.content, format: day.format, platform: day.platform, phase: day.phase }
        const piece = await produceContent(ctx, idea, { emit: dayEmit, step, call })
        for (const k of Object.keys(dayUsage)) usage[k] += dayUsage[k]
        stats.agentCalls += dayStats.agentCalls
        done++
        await onDayDone?.()
        const detail = `Score ${piece.quality.overall_score}/10${piece.needsReview ? ' — needs review' : ''}${piece.marketFit.marketRisk ? ' · market risk' : ''}`
        emit({ type: 'day', date: day.date, status: 'done', detail, result: { day, ...piece, marketBrief: briefSummary(briefs.get(p)), cost: generationCost(dayUsage, dayStats) } })
      } catch (err) {
        stats.agentCalls += dayStats.agentCalls
        for (const k of Object.keys(dayUsage)) usage[k] += dayUsage[k]
        if (signal?.aborted) return
        failed++
        emit({ type: 'day', date: day.date, status: 'error', detail: friendlyError(err) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DAY_CONCURRENCY, plan.days.length) }, worker))
  const cost = generationCost(usage, stats, research)
  logGeneration(`plan generate] [${plan.name} · ${plan.days.length} days`, cost)
  return { done, failed, brandProfile: profile, cost }
}

export const goalOrDefault = (goal) => (GOALS[goal] ? goal : 'blogger')
