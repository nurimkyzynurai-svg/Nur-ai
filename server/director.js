import {
  brandDnaAgent,
  trendAgent,
  creativeDirectorAgent,
  conceptPickAgent,
  hookAgent,
  scriptAgent,
  qualityAgent,
  captionAgent,
  directorAgent,
  marketFitAgent,
  MARKET_FIT_PASS,
  PASS_SCORE,
  MAX_ATTEMPTS,
} from '../src/agents/index.js'
import { runAgent } from './claude.js'
import { checkScript } from './checks.js'
import { addUsage, costOf, emptyUsage } from './cost.js'
import { MOCK } from './claude.js'
import { comboOf, getFreshBrief, trackCombo } from './marketIntel.js'

const clampIndex = (i, length) => Math.min(Math.max(Math.round(i) || 0, 0), length - 1)

/**
 * A small helper every pipeline uses: runs one agent, reports progress through `emit`
 *   { type: 'step', agent, name, status: 'running' | 'done' | 'skipped', detail }
 * and adds the call's token usage to `usage`.
 */
export function makeStepper(emit, { signal, usage, stats = { agentCalls: 0 } }) {
  const call = (agent, input) => {
    stats.agentCalls++
    return runAgent(agent, input, { signal, onUsage: (u) => addUsage(usage, u) })
  }
  const step = async (agent, input, detail, summarize) => {
    emit({ type: 'step', agent: agent.id, name: agent.name, status: 'running', detail })
    const out = await call(agent, input)
    emit({ type: 'step', agent: agent.id, name: agent.name, status: 'done', detail: summarize(out) })
    return out
  }
  return { call, step, stats }
}

/** Brand DNA: reuse the saved profile, or build it from the Voice Setup answers. */
export async function ensureBrand({ niche, goal, language, brandProfile, brandInputs }, emit, { step }) {
  if (brandProfile) {
    emit({ type: 'step', agent: brandDnaAgent.id, name: brandDnaAgent.name, status: 'skipped', detail: 'Using your saved Brand DNA profile' })
    return brandProfile
  }
  const profile = await step(brandDnaAgent, { niche, goal, language, ...brandInputs }, 'Analyzing your posts and answers…', (p) => `Tone: ${p.tone}`)
  emit({ type: 'brandProfile', profile })
  return profile
}

/**
 * Market Intelligence: today's cited Market Brief for this niche + platform + language (shared, cached 24 h).
 * Returns { brief, research } — brief is null when market data is unavailable; research is the web-research
 * cost when a new brief had to be made during this request.
 */
export async function ensureMarketBrief({ niche, nicheDescription, platform, language }, emit) {
  const combo = comboOf({ niche, platform, language })
  await trackCombo(combo)
  const name = 'Market Intelligence Agent'
  emit({ type: 'step', agent: 'market', name, status: 'running', detail: `Checking today’s Market Brief (${combo.platform}, ${combo.language})…` })
  const market = await getFreshBrief(combo, {
    nicheDescription,
    onResearch: (max) => emit({ type: 'step', agent: 'market', name, status: 'running', detail: `Researching the web (up to ${max} searches)…` }),
  })
  const brief = market.brief
  emit({
    type: 'step',
    agent: 'market',
    name,
    status: brief && market.cached ? 'skipped' : 'done',
    detail: brief
      ? `${market.cached ? 'Using' : 'New'} brief from ${brief.createdAt.slice(0, 10)} · ${brief.sources.length} sources`
      : 'Market data unavailable — continuing without it',
  })
  return { brief, research: market.research || null }
}

/** Source ids that back at least one verified item in the brief. */
function verifiedSourceIds(brief) {
  const ids = new Set()
  for (const v of Object.values(brief)) if (Array.isArray(v)) for (const it of v) if (it?.verified) for (const id of it.source_ids || []) ids.add(id)
  return [...ids]
}

export const briefSummary = (brief) =>
  brief
    ? {
        createdAt: brief.createdAt,
        platform: brief.platform,
        language: brief.language,
        summary: brief.summary,
        sources: brief.sources,
        verifiedSourceIds: verifiedSourceIds(brief),
        mock: brief.mock,
      }
    : null

const clampScore = (n) => Math.min(10, Math.max(1, Math.round(Number(n) || 1)))

/** Keeps only source ids that exist in the brief, and turns them into links with a verified flag. */
function citeSources(ids, brief) {
  const verified = new Set(verifiedSourceIds(brief))
  return [...new Set(ids)]
    .map((id) => brief.sources.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => ({ id: s.id, url: s.url, title: s.title, verified: verified.has(s.id) }))
}

function shapeMarketFit(fit, brief, extra) {
  const score = clampScore(fit.market_fit_score)
  return {
    available: true,
    score,
    pass: MARKET_FIT_PASS,
    marketRisk: score < MARKET_FIT_PASS,
    dimensions: fit.dimensions.map((d) => ({ ...d, score: clampScore(d.score) })),
    whyNow: fit.why_now,
    whyNowSources: citeSources(fit.why_now_source_ids, brief),
    mainRisk: fit.main_risk,
    riskSources: citeSources(fit.risk_source_ids, brief),
    improvement: fit.improvement,
    briefDate: brief.createdAt,
    ...extra,
  }
}

/**
 * Turns one idea into a finished piece: hooks → script ⇄ quality loop → captions.
 * Used for Create Content (after Trend + Creative Director) and for every Content Plan day.
 */
/** One Quality Agent review plus the rule checks in code. Returns the scored review. */
async function review({ ctx, idea, hook, script, attempt, previousFeedback, emit, call }) {
  emit({ type: 'step', agent: qualityAgent.id, name: qualityAgent.name, status: 'running', detail: `Scoring draft ${attempt}…` })
  const quality = await call(qualityAgent, { ...ctx, idea, hook, script, attempt, previousFeedback })
  const ruleIssues = checkScript({ script, goal: ctx.goal, previousFeedback })
  const unfixed = quality.previous_feedback_check.filter((c) => !c.fixed)
  quality.feedback = [...ruleIssues, ...quality.feedback]
  quality.overall_score = Math.round(quality.overall_score)
  if (ruleIssues.length || unfixed.length) quality.overall_score = Math.min(quality.overall_score, PASS_SCORE - 1)
  quality.passed = quality.overall_score >= PASS_SCORE
  return quality
}

export async function produceContent(ctx, idea, { emit, step, call }) {
  // Hooks
  const hooks = await step(hookAgent, { ...ctx, idea }, `Writing hooks for “${idea.title}”…`, (h) => `${h.hooks.length} hooks written`)
  if (!hooks.hooks.length) throw new Error('Hook Agent returned no hooks. Try again.')
  const hookIdx = clampIndex(hooks.best_hook_index, hooks.hooks.length)
  const hook = hooks.hooks[hookIdx]

  // Script ⇄ Quality loop: rewrite with feedback until the draft scores at least
  // PASS_SCORE, for up to MAX_ATTEMPTS drafts. The best draft wins.
  let script
  let quality
  let best
  let feedback = []
  const attempts = []
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const previousFeedback = feedback
    script = await step(
      scriptAgent,
      { ...ctx, idea, hook, feedback: previousFeedback, previousScript: script },
      attempt === 1 ? 'Writing the full script…' : `Fixing ${previousFeedback.length} feedback points (try ${attempt} of ${MAX_ATTEMPTS})…`,
      (s) => (attempt === 1 ? `Draft 1: ${Math.round(s.duration_seconds)}s script` : `Draft ${attempt}: ${s.fixes.length} fixes made`),
    )

    quality = await review({ ctx, idea, hook, script, attempt, previousFeedback, emit, call })
    feedback = quality.passed ? [] : quality.feedback

    const verdict = quality.passed ? 'approved' : attempt < MAX_ATTEMPTS ? `${quality.feedback.length} points sent back` : 'still below the bar'
    emit({ type: 'step', agent: qualityAgent.id, name: qualityAgent.name, status: 'done', detail: `Score ${quality.overall_score}/10 — ${verdict}` })

    attempts.push({ attempt, score: quality.overall_score, passed: quality.passed, feedbackCount: quality.feedback.length })
    // On a tie keep the later draft: it has more feedback fixed.
    if (!best || quality.overall_score >= best.quality.overall_score) best = { script, quality, attempt }
    if (quality.passed) break
  }
  ;({ script, quality } = best)
  quality = { ...quality, attempts, bestAttempt: best.attempt }

  // Market Fit: checks the approved script against today's Market Brief (no web searches).
  // Below MARKET_FIT_PASS → one rewrite round (script + quality + re-check), then label "market risk" if still low.
  let marketFit
  if (!ctx.marketBrief) {
    emit({ type: 'step', agent: marketFitAgent.id, name: marketFitAgent.name, status: 'skipped', detail: 'Market data unavailable — not scored' })
    marketFit = { available: false }
  } else {
    const fitDetail = (f) => `Market fit ${clampScore(f.market_fit_score)}/10`
    let fit = await step(marketFitAgent, { ...ctx, idea, hook, script, marketFitRound: 1 }, 'Checking fit with today’s market…', (f) =>
      `${fitDetail(f)}${clampScore(f.market_fit_score) < MARKET_FIT_PASS ? ' — sending back once' : ''}`,
    )
    let rewrite = null
    if (clampScore(fit.market_fit_score) < MARKET_FIT_PASS) {
      const mfFeedback = [
        {
          id: 'MF1',
          quote: '',
          problem: `Market fit ${clampScore(fit.market_fit_score)}/10. ${fit.main_risk}`,
          fix: fit.rewrite_instruction || fit.improvement,
        },
      ]
      const candidate = await step(
        scriptAgent,
        { ...ctx, idea, hook, feedback: mfFeedback, previousScript: script },
        'Rewriting for market fit (one extra round)…',
        (s2) => `Market rewrite: ${s2.fixes.length} fix made`,
      )
      const q2 = await review({ ctx, idea, hook, script: candidate, attempt: MAX_ATTEMPTS, previousFeedback: mfFeedback, emit, call })
      emit({ type: 'step', agent: qualityAgent.id, name: qualityAgent.name, status: 'done', detail: `Market rewrite scored ${q2.overall_score}/10` })
      const fit2 = await step(marketFitAgent, { ...ctx, idea, hook, script: candidate, marketFitRound: 2 }, 'Re-checking market fit…', fitDetail)
      // Keep the rewrite only if it is at least as good on quality and better (or equal) on market fit.
      const keeps = q2.overall_score >= Math.min(PASS_SCORE, quality.overall_score) && clampScore(fit2.market_fit_score) >= clampScore(fit.market_fit_score)
      rewrite = { kept: keeps, firstScore: clampScore(fit.market_fit_score), secondScore: clampScore(fit2.market_fit_score), qualityScore: q2.overall_score }
      if (keeps) {
        script = candidate
        quality = { ...q2, attempts: [...attempts, { attempt: 'market', score: q2.overall_score, passed: q2.passed, feedbackCount: q2.feedback.length }], bestAttempt: 'market' }
        fit = fit2
      }
    }
    marketFit = shapeMarketFit(fit, ctx.marketBrief, { rewrite })
  }

  // Captions
  const captions = await step(captionAgent, { ...ctx, idea, hook, script }, 'Writing captions for every platform…', (c) => `${c.captions.length} platforms ready`)

  return {
    hooks: hooks.hooks,
    bestHookIndex: hookIdx,
    hookReasoning: hooks.reasoning,
    hook,
    script,
    quality: { ...quality, passScore: PASS_SCORE, maxAttempts: MAX_ATTEMPTS },
    needsReview: !quality.passed,
    marketFit,
    captions: captions.captions,
  }
}

/**
 * Create Content: the full Director pipeline for one video.
 * Brand DNA → Market Brief → Trends → Creative Director → Director picks → hooks/script/quality/captions → Director summary.
 */
/** Totals for one generation: agent calls, research calls, web searches and estimated cost. */
export function generationCost(usage, stats, research = []) {
  const total = { ...usage }
  let researchCalls = 0
  for (const r of research.filter(Boolean)) {
    for (const k of ['inputTokens', 'outputTokens', 'cacheWriteTokens', 'cacheReadTokens', 'webSearches']) total[k] += r[k] || 0
    researchCalls += r.calls || 0
  }
  return {
    agentCalls: stats.agentCalls,
    researchCalls,
    claudeCalls: stats.agentCalls + researchCalls,
    webSearches: total.webSearches,
    usd: MOCK ? 0 : costOf(total),
    mock: MOCK,
  }
}

export function logGeneration(label, cost) {
  console.log(
    `[${label}] ${cost.claudeCalls} Claude calls (${cost.agentCalls} agent + ${cost.researchCalls} research), ` +
      `${cost.webSearches} web searches, ~$${cost.usd.toFixed(3)}${cost.mock ? ' — sample mode, 0 real API calls' : ''}`,
  )
}

export async function runDirector({ niche, nicheDescription, goal, language, platform, brandProfile, brandInputs }, emit, { signal } = {}) {
  const usage = emptyUsage()
  const { step, call, stats } = makeStepper(emit, { signal, usage })

  const profile = await ensureBrand({ niche: nicheDescription || niche, goal, language, brandProfile, brandInputs }, emit, { step })
  const market = await ensureMarketBrief({ niche, nicheDescription, platform, language }, emit)
  const marketBrief = market.brief
  const ctx = { brandProfile: profile, goal, language, niche, nicheDescription, platform, marketBrief }

  // Trends
  const trends = await step(trendAgent, ctx, 'Finding 10 trending ideas…', (t) => `${t.ideas.length} ideas found`)
  if (!trends.ideas.length) throw new Error('Trend Agent returned no ideas. Try again.')

  // Creative Director: 3 bold concepts built on the best ideas.
  const creative = await step(creativeDirectorAgent, { ...ctx, ideas: trends.ideas }, 'Developing 3 bold creative concepts…', (c) => `${c.concepts.length} concepts proposed`)
  if (!creative.concepts.length) throw new Error('Creative Director returned no concepts. Try again.')

  // Director picks the strongest concept.
  const pick = await step(conceptPickAgent, { ...ctx, concepts: creative.concepts }, 'Picking the strongest concept…', (p) => {
    const c = creative.concepts[clampIndex(p.chosen_index, creative.concepts.length)]
    return `Chose “${c.title}”`
  })
  const chosenIndex = clampIndex(pick.chosen_index, creative.concepts.length)
  const concept = creative.concepts[chosenIndex]
  const baseIdea = trends.ideas[clampIndex(concept.based_on_idea_index, trends.ideas.length)]
  const idea = { ...baseIdea, title: concept.title, creative_concept: concept, director_notes: pick.director_notes }

  const piece = await produceContent(ctx, idea, { emit, step, call })

  // Director combines everything.
  const plan = await step(
    directorAgent,
    { ...ctx, idea, hook: piece.hook, script: piece.script, quality: piece.quality, captions: piece.captions },
    'Reviewing the team’s work…',
    () => 'Final package ready',
  )

  return {
    niche,
    goal,
    language,
    platform,
    brandProfile: profile,
    marketBrief: briefSummary(marketBrief),
    marketDataUnavailable: !marketBrief,
    ideas: trends.ideas,
    idea,
    creative: { concepts: creative.concepts, chosenIndex, reasoning: pick.reasoning, scores: pick.scores, directorNotes: pick.director_notes },
    ...piece,
    plan,
    cost: (() => {
      const cost = generationCost(usage, stats, [market.research])
      logGeneration(`generate] [${niche} · ${platform} · ${language}`, cost)
      return cost
    })(),
  }
}
