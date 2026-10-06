import crypto from 'node:crypto'
import { marketIntelAgent, BRIEF_SECTIONS } from '../src/agents/marketIntelAgent.js'
import { founderReportAgent } from '../src/agents/founderReportAgent.js'
import { MOCK } from './claude.js'
import { costOf, emptyUsage, estimateResearchCost } from './cost.js'
import { runResearchAgent, validateItems } from './research.js'
import { readJSON, updateJSON } from './store.js'

const DAY = 24 * 60 * 60 * 1000
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)

export const CONFIG = {
  briefMaxSearches: num(process.env.MARKET_BRIEF_MAX_SEARCHES, 5),
  reportMaxSearches: num(process.env.FOUNDER_REPORT_MAX_SEARCHES, 10),
  maxScheduledBriefsPerDay: num(process.env.MARKET_INTEL_MAX_NICHES_PER_DAY, 10),
  schedulerEnabled: process.env.MARKET_INTEL_SCHEDULER !== 'false',
  briefTtlMs: DAY,
  reportTtlMs: 7 * DAY,
  keepBriefs: 14,
  keepReports: 12,
}

export const nicheKey = (niche) => niche.trim().toLowerCase().replace(/\s+/g, ' ')
const briefFile = (niche) => `briefs/${crypto.createHash('sha1').update(nicheKey(niche)).digest('hex').slice(0, 16)}.json`

// What is running right now (for the admin page), and de-duplication of identical runs.
const inflight = new Map()
export const runningJobs = () => [...inflight.values()].map(({ type, niche, startedAt }) => ({ type, niche, startedAt }))

function once(key, meta, fn) {
  if (!inflight.has(key)) {
    const promise = fn().finally(() => inflight.delete(key))
    inflight.set(key, { ...meta, startedAt: new Date().toISOString(), promise })
  }
  return inflight.get(key).promise
}

async function logRun(entry) {
  await updateJSON('runs.json', [], (runs) => [{ at: new Date().toISOString(), ...entry }, ...runs].slice(0, 500))
}

// ---------- Market Briefs (per niche, daily) ----------

export async function trackNiche(niche) {
  const key = nicheKey(niche)
  await updateJSON('niches.json', {}, (all) => ({ ...all, [key]: { ...all[key], niche: niche.trim(), lastRequestedAt: new Date().toISOString() } }))
}

export async function listBriefs(niche) {
  return readJSON(briefFile(niche), [])
}

export async function latestBrief(niche) {
  return (await listBriefs(niche))[0] || null
}

const isFresh = (item, ttl) => item && Date.now() - new Date(item.createdAt).getTime() < ttl

export function runBrief(niche, { trigger = 'manual' } = {}) {
  return once(`brief:${nicheKey(niche)}`, { type: 'brief', niche }, async () => {
    const started = Date.now()
    const maxSearches = CONFIG.briefMaxSearches
    try {
      const { data, sources, usage } = MOCK ? await mockResearch('brief') : await runResearchAgent(marketIntelAgent, { niche }, { maxSearches })
      const brief = {
        id: crypto.randomUUID(),
        niche: niche.trim(),
        createdAt: new Date().toISOString(),
        trigger,
        mock: MOCK,
        summary: data.summary,
        sources,
        cost: { ...usage, usd: MOCK ? 0 : costOf(usage), estimateUsd: estimateResearchCost(maxSearches), maxSearches },
        durationMs: Date.now() - started,
      }
      for (const [key] of BRIEF_SECTIONS) brief[key] = validateItems(data[key] || [], sources)
      await updateJSON(briefFile(niche), [], (list) => [brief, ...list].slice(0, CONFIG.keepBriefs))
      await updateJSON('niches.json', {}, (all) => ({ ...all, [nicheKey(niche)]: { ...all[nicheKey(niche)], niche: niche.trim(), lastBriefAt: brief.createdAt } }))
      await logRun({ type: 'brief', niche, ok: true, usd: brief.cost.usd, searches: usage.webSearches, trigger })
      return brief
    } catch (err) {
      await logRun({ type: 'brief', niche, ok: false, error: err.message, trigger })
      throw err
    }
  })
}

/**
 * Used by the Director before writing content: returns today's brief, researching it
 * first if the cached one is older than 24 hours. Returns null if research fails.
 */
export async function getFreshBrief(niche, { onResearch } = {}) {
  const cached = await latestBrief(niche)
  if (isFresh(cached, CONFIG.briefTtlMs)) return { brief: cached, cached: true }
  onResearch?.(CONFIG.briefMaxSearches)
  try {
    return { brief: await runBrief(niche, { trigger: 'on-demand' }), cached: false }
  } catch (err) {
    console.error('Market brief failed:', err.message)
    // A stale brief is better than none; the agents see its date.
    return { brief: cached, cached: true, error: err.message }
  }
}

// ---------- Founder report (weekly) ----------

export async function listReports() {
  return readJSON('founder-reports.json', [])
}

export function runFounderReport({ trigger = 'manual' } = {}) {
  return once('founder-report', { type: 'founder-report' }, async () => {
    const started = Date.now()
    const maxSearches = CONFIG.reportMaxSearches
    try {
      const { data, sources, usage } = MOCK ? await mockResearch('report') : await runResearchAgent(founderReportAgent, {}, { maxSearches })
      const ids = new Set(sources.map((s) => s.id))
      const report = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        trigger,
        mock: MOCK,
        summary: data.summary,
        ai_models: validateItems(data.ai_models, sources),
        competitor_updates: validateItems(data.competitor_updates, sources),
        platform_api_changes: validateItems(data.platform_api_changes, sources),
        suggestions: data.suggestions.map((s) => ({ ...s, source_ids: s.source_ids.filter((id) => ids.has(id)) })),
        sources,
        cost: { ...usage, usd: MOCK ? 0 : costOf(usage), estimateUsd: estimateResearchCost(maxSearches), maxSearches },
        durationMs: Date.now() - started,
      }
      await updateJSON('founder-reports.json', [], (list) => [report, ...list].slice(0, CONFIG.keepReports))
      await logRun({ type: 'founder-report', ok: true, usd: report.cost.usd, searches: usage.webSearches, trigger })
      return report
    } catch (err) {
      await logRun({ type: 'founder-report', ok: false, error: err.message, trigger })
      throw err
    }
  })
}

// ---------- Admin overview ----------

export async function overview() {
  const [niches, reports, runs] = await Promise.all([readJSON('niches.json', {}), listReports(), readJSON('runs.json', [])])
  const since = Date.now() - 30 * DAY
  const recent = runs.filter((r) => new Date(r.at).getTime() > since)
  const briefs = await Promise.all(
    Object.values(niches).map(async (n) => {
      const b = await latestBrief(n.niche)
      return { niche: n.niche, lastRequestedAt: n.lastRequestedAt || null, latest: b }
    }),
  )
  briefs.sort((a, b) => (b.lastRequestedAt || '').localeCompare(a.lastRequestedAt || ''))
  return {
    config: {
      briefMaxSearches: CONFIG.briefMaxSearches,
      reportMaxSearches: CONFIG.reportMaxSearches,
      maxScheduledBriefsPerDay: CONFIG.maxScheduledBriefsPerDay,
      schedulerEnabled: CONFIG.schedulerEnabled,
      briefEstimateUsd: estimateResearchCost(CONFIG.briefMaxSearches),
      reportEstimateUsd: estimateResearchCost(CONFIG.reportMaxSearches),
      mock: MOCK,
    },
    running: runningJobs(),
    reports,
    briefs,
    costs: {
      last30DaysUsd: Math.round(recent.reduce((sum, r) => sum + (r.usd || 0), 0) * 100) / 100,
      runs: recent.length,
      failures: recent.filter((r) => !r.ok).length,
    },
    recentRuns: runs.slice(0, 20),
  }
}

// ---------- Scheduler ----------

async function tick() {
  if (!MOCK && !process.env.ANTHROPIC_API_KEY) return
  const runs = await readJSON('runs.json', [])
  const today = new Date().toISOString().slice(0, 10)
  let budget = CONFIG.maxScheduledBriefsPerDay - runs.filter((r) => r.type === 'brief' && r.trigger === 'scheduled' && r.at.startsWith(today)).length

  // Daily: refresh briefs for niches clients used in the last 14 days, most recent first.
  const niches = Object.values(await readJSON('niches.json', {}))
    .filter((n) => n.lastRequestedAt && Date.now() - new Date(n.lastRequestedAt).getTime() < 14 * DAY)
    .sort((a, b) => b.lastRequestedAt.localeCompare(a.lastRequestedAt))
  for (const n of niches) {
    if (budget <= 0) break
    if (isFresh(await latestBrief(n.niche), CONFIG.briefTtlMs)) continue
    budget--
    await runBrief(n.niche, { trigger: 'scheduled' }).catch((err) => console.error(`Scheduled brief for "${n.niche}" failed:`, err.message))
  }

  // Weekly: founder report.
  if (!isFresh((await listReports())[0], CONFIG.reportTtlMs)) {
    await runFounderReport({ trigger: 'scheduled' }).catch((err) => console.error('Scheduled founder report failed:', err.message))
  }
}

export function startScheduler() {
  if (!CONFIG.schedulerEnabled) return console.log('Market Intel scheduler is off (MARKET_INTEL_SCHEDULER=false).')
  let busy = false
  const run = async () => {
    if (busy) return
    busy = true
    try {
      await tick()
    } catch (err) {
      console.error('Market Intel scheduler error:', err)
    } finally {
      busy = false
    }
  }
  setTimeout(run, 60 * 1000) // first check a minute after start
  setInterval(run, 60 * 60 * 1000).unref() // then every hour
  console.log('Market Intel scheduler on: daily briefs per active niche, weekly founder report.')
}

// ---------- Sample mode (MOCK_AI) ----------

async function mockResearch(kind) {
  await new Promise((r) => setTimeout(r, 900))
  const sources = [
    { id: 'S1', url: 'https://example.com/sample-platform-update', title: 'SAMPLE source — mock mode, not real', pageAge: '' },
    { id: 'S2', url: 'https://example.com/sample-trend-roundup', title: 'SAMPLE source — mock mode, not real', pageAge: '' },
  ]
  const item = (title, detail, platform, ids, verified = true) => ({ title, detail, platform, source_ids: ids, verified, date_seen: '' })
  const usage = { ...emptyUsage(), calls: 2, inputTokens: 40000, outputTokens: 9000, webSearches: kind === 'brief' ? 4 : 8 }
  if (kind === 'brief') {
    return {
      sources,
      usage,
      data: {
        summary: 'SAMPLE BRIEF (mock mode). This is placeholder text so you can see the layout — no real research was done.',
        platform_updates: [item('Sample: platform favors saves and shares', 'Placeholder item showing how a platform update looks.', 'Instagram', ['S1'])],
        trending_formats: [item('Sample: myth-vs-fact videos', 'Placeholder item for a trending format.', 'TikTok', ['S2'])],
        trending_sounds: [],
        trending_topics: [item('Sample: an unconfirmed topic', 'Placeholder item that is not verified.', '', [], false)],
        marketing_tactics: [item('Sample: comment-keyword lead magnets', 'Placeholder item for a tactic.', 'Instagram', ['S2'])],
        competitor_activity: [],
        audience_interests: [],
      },
    }
  }
  return {
    sources,
    usage,
    data: {
      summary: 'SAMPLE REPORT (mock mode). Placeholder text so you can see the layout — no real research was done.',
      ai_models: [{ ...item('Sample: a new voice model', 'Placeholder item for an AI model release.', '', ['S1']), category: 'voice' }],
      competitor_updates: [{ ...item('Sample: competitor adds auto-captions', 'Placeholder competitor update.', '', ['S2']), competitor: 'Sample Co' }],
      platform_api_changes: [item('Sample: rumored API change', 'Placeholder item that is not verified.', 'X', [], false)],
      suggestions: [{ title: 'Sample: add AI voiceover', why: 'Placeholder suggestion tied to S1.', effort: 'medium', impact: 'high', source_ids: ['S1'] }],
    },
  }
}
