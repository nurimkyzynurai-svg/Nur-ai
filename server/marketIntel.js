import crypto from 'node:crypto'
import { marketIntelAgent, BRIEF_SECTIONS } from '../src/agents/marketIntelAgent.js'
import { founderReportAgent } from '../src/agents/founderReportAgent.js'
import { MOCK } from './claude.js'
import { costOf, emptyUsage, estimateResearchCost } from './cost.js'
import { runResearchAgent, validateItems } from './research.js'
import { readJSON, updateJSON } from './store.js'
import { ANY_PLATFORM, TARGET_PLATFORMS } from '../src/agents/shared.js'

const DAY = 24 * 60 * 60 * 1000
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)

export const CONFIG = {
  briefMaxSearches: num(process.env.MARKET_BRIEF_MAX_SEARCHES, 5),
  reportMaxSearches: num(process.env.FOUNDER_REPORT_MAX_SEARCHES, 10),
  maxScheduledBriefsPerDay: num(process.env.MARKET_INTEL_MAX_NICHES_PER_DAY, 10),
  // "on" turns on the daily briefs + weekly founder report. Anything else (or missing) = off.
  schedulerEnabled: String(process.env.MARKET_INTEL_SCHEDULER || 'off').trim().toLowerCase() === 'on',
  failureBackoffMs: 30 * 60 * 1000,
  briefTtlMs: DAY,
  reportTtlMs: 7 * DAY,
  keepBriefs: 14,
  keepReports: 12,
}

const norm = (v) => String(v || '').trim().replace(/\s+/g, ' ')
export const nicheKey = (niche) => norm(niche).toLowerCase()

/** A brief is shared by every client with the same niche + target platform + language. */
export function comboOf({ niche, platform, language }) {
  const p = TARGET_PLATFORMS.find((x) => x.toLowerCase() === norm(platform).toLowerCase()) || ANY_PLATFORM
  return { niche: norm(niche), platform: p, language: norm(language) || 'English' }
}
export const comboKey = (c) => `${nicheKey(c.niche)}|${c.platform.toLowerCase()}|${c.language.toLowerCase()}`
const briefFile = (c) => `briefs/${crypto.createHash('sha1').update(comboKey(c)).digest('hex').slice(0, 16)}.json`
const comboLabel = (c) => `${c.niche} · ${c.platform} · ${c.language}`

// What is running right now (for the admin page), and de-duplication of identical runs.
const inflight = new Map()
export const runningJobs = () => [...inflight.values()].map(({ type, niche, platform, language, startedAt }) => ({ type, niche, platform, language, startedAt }))

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

// ---------- Market Briefs (per niche + platform + language, daily, shared) ----------

export async function trackCombo(input) {
  const c = comboOf(input)
  await updateJSON('niches.json', {}, (all) => ({ ...all, [comboKey(c)]: { ...all[comboKey(c)], ...c, lastRequestedAt: new Date().toISOString() } }))
}

export async function listBriefs(input) {
  return readJSON(briefFile(comboOf(input)), [])
}

export async function latestBrief(input) {
  return (await listBriefs(input))[0] || null
}

const isFresh = (item, ttl) => item && Date.now() - new Date(item.createdAt).getTime() < ttl

export function runBrief(input, { trigger = 'manual' } = {}) {
  const c = comboOf(input)
  return once(`brief:${comboKey(c)}`, { type: 'brief', ...c }, async () => {
    const started = Date.now()
    const maxSearches = CONFIG.briefMaxSearches
    try {
      const { data, sources, usage } = MOCK ? await mockResearch('brief', c) : await runResearchAgent(marketIntelAgent, c, { maxSearches })
      const brief = {
        id: crypto.randomUUID(),
        ...c,
        createdAt: new Date().toISOString(),
        trigger,
        mock: MOCK,
        summary: data.summary,
        sources,
        cost: { ...usage, usd: MOCK ? 0 : costOf(usage), estimateUsd: estimateResearchCost(maxSearches), maxSearches },
        durationMs: Date.now() - started,
      }
      for (const [key] of BRIEF_SECTIONS) brief[key] = validateItems(data[key] || [], sources)
      await updateJSON(briefFile(c), [], (list) => [brief, ...list].slice(0, CONFIG.keepBriefs))
      await updateJSON('niches.json', {}, (all) => ({ ...all, [comboKey(c)]: { ...all[comboKey(c)], ...c, lastBriefAt: brief.createdAt } }))
      await logRun({ type: 'brief', niche: comboLabel(c), ok: true, usd: brief.cost.usd, searches: usage.webSearches, trigger })
      return brief
    } catch (err) {
      await logRun({ type: 'brief', niche: comboLabel(c), ok: false, error: err.message, trigger })
      throw err
    }
  })
}

// Recent research failures per combination, so a broken web search isn't retried on every generation.
const recentFailures = new Map()

/**
 * Used before writing content: returns today's brief for this niche + platform + language, researching it first
 * if there is none from the last 24 hours. If research fails, returns { brief: null, unavailable: true } —
 * the agents then work without market data instead of guessing.
 */
export async function getFreshBrief(input, { onResearch } = {}) {
  const c = comboOf(input)
  const cached = await latestBrief(c)
  if (isFresh(cached, CONFIG.briefTtlMs)) return { brief: cached, cached: true }

  const failedAt = recentFailures.get(comboKey(c))
  if (failedAt && Date.now() - failedAt < CONFIG.failureBackoffMs) {
    return { brief: null, unavailable: true, error: 'Market research failed recently; trying again later.' }
  }
  onResearch?.(CONFIG.briefMaxSearches)
  try {
    const brief = await runBrief(c, { trigger: 'on-demand' })
    recentFailures.delete(comboKey(c))
    return { brief, cached: false, research: brief.cost }
  } catch (err) {
    console.error(`Market brief failed for ${comboLabel(c)}:`, err.message)
    recentFailures.set(comboKey(c), Date.now())
    return { brief: null, unavailable: true, error: err.message, research: err.usage || null }
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
      const c = comboOf(n)
      return { ...c, key: comboKey(c), lastRequestedAt: n.lastRequestedAt || null, latest: await latestBrief(c) }
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
    if (isFresh(await latestBrief(n), CONFIG.briefTtlMs)) continue
    budget--
    await runBrief(n, { trigger: 'scheduled' }).catch((err) => console.error(`Scheduled brief for "${comboLabel(comboOf(n))}" failed:`, err.message))
  }

  // Weekly: founder report.
  if (!isFresh((await listReports())[0], CONFIG.reportTtlMs)) {
    await runFounderReport({ trigger: 'scheduled' }).catch((err) => console.error('Scheduled founder report failed:', err.message))
  }
}

export function startScheduler() {
  if (!CONFIG.schedulerEnabled) {
    return console.log('Market Intel scheduler: OFF — briefs are created on demand during generation (set MARKET_INTEL_SCHEDULER=on to enable).')
  }
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
  console.log('Market Intel scheduler: ON — daily briefs for active niche/platform/language combinations, weekly founder report.')
}

// ---------- Sample mode (MOCK_AI) ----------

async function mockResearch(kind, c = {}) {
  await new Promise((r) => setTimeout(r, 900))
  const niche = c.niche || 'your niche'
  const platform = c.platform || ANY_PLATFORM
  const sources = [
    { id: 'S1', url: 'https://example.com/sample/platform-update', title: `Sample source: ${platform} creator update (mock mode)`, pageAge: '' },
    { id: 'S2', url: 'https://example.com/sample/niche-trends', title: `Sample source: what ${niche} audiences engage with (mock mode)`, pageAge: '' },
    { id: 'S3', url: 'https://example.com/sample/marketing-tactics', title: 'Sample source: short-form marketing tactics (mock mode)', pageAge: '' },
  ]
  const item = (title, detail, plat, ids, verified = true) => ({ title, detail, platform: plat, source_ids: ids, verified, date_seen: '' })
  const usage = emptyUsage() // sample mode makes no API calls and no web searches
  if (kind === 'brief') {
    return {
      sources,
      usage,
      data: {
        summary: `Sample brief (mock mode, no real research): ${platform} is rewarding original, watch-through-friendly short videos; audiences in ${niche} respond to honest, specific answers and are tired of generic list videos.`,
        platform_updates: [
          item('Original content over reposts', `${platform} says it ranks original videos above reposted or watermarked clips.`, platform, ['S1']),
          item('Watch-through matters', 'Videos that are watched to the end get shown to more people; tight edits help.', platform, ['S1']),
        ],
        trending_formats: [
          item('Show the result first', `Creators in ${niche} open with the outcome, then explain how.`, platform, ['S2']),
          item('Honest myth-vs-fact', 'Short videos that correct a common belief with a visible example.', platform, ['S2']),
        ],
        saturated_formats: [item('Generic “top 5 tips” lists', `Plain list videos are everywhere in ${niche} and get skipped.`, platform, ['S2'])],
        trending_sounds: [],
        trending_topics: [item('A question audiences keep asking', `People in ${niche} are asking for clear, practical answers.`, '', ['S2'])],
        marketing_tactics: [
          item('Comment-keyword offers', 'Ending with “comment a keyword to get the guide” turns viewers into leads.', '', ['S3']),
          item('A claimed rule change', 'Some blogs claim a new reach rule; no official source found.', platform, [], false),
        ],
        competitor_activity: [],
        audience_interests: [item('Behind the scenes', 'Audiences engage with how things are really made or done.', '', ['S2'])],
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
