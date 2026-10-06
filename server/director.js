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
  PASS_SCORE,
  MAX_ATTEMPTS,
} from '../src/agents/index.js'
import { runAgent } from './claude.js'
import { checkScript } from './checks.js'
import { addUsage, costOf, emptyUsage } from './cost.js'
import { getFreshBrief, trackNiche } from './marketIntel.js'

const clampIndex = (i, length) => Math.min(Math.max(Math.round(i) || 0, 0), length - 1)

/**
 * A small helper every pipeline uses: runs one agent, reports progress through `emit`
 *   { type: 'step', agent, name, status: 'running' | 'done' | 'skipped', detail }
 * and adds the call's token usage to `usage`.
 */
export function makeStepper(emit, { signal, usage }) {
  const call = (agent, input) => runAgent(agent, input, { signal, onUsage: (u) => addUsage(usage, u) })
  const step = async (agent, input, detail, summarize) => {
    emit({ type: 'step', agent: agent.id, name: agent.name, status: 'running', detail })
    const out = await call(agent, input)
    emit({ type: 'step', agent: agent.id, name: agent.name, status: 'done', detail: summarize(out) })
    return out
  }
  return { call, step }
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

/** Market Intelligence: today's cited Market Brief for this niche (cached for 24 hours). */
export async function ensureMarketBrief(niche, emit) {
  await trackNiche(niche)
  const name = 'Market Intelligence Agent'
  emit({ type: 'step', agent: 'market', name, status: 'running', detail: 'Checking today’s Market Brief…' })
  const market = await getFreshBrief(niche, {
    onResearch: (max) => emit({ type: 'step', agent: 'market', name, status: 'running', detail: `Researching the web (up to ${max} searches)…` }),
  })
  const brief = market.brief
  emit({
    type: 'step',
    agent: 'market',
    name,
    status: brief && market.cached ? 'skipped' : 'done',
    detail: brief
      ? `${market.cached ? 'Using' : 'New'} brief from ${brief.createdAt.slice(0, 10)} · ${brief.sources.length} sources${market.error ? ' (refresh failed — older brief)' : ''}`
      : 'No brief available — agents will use evergreen ideas only',
  })
  return brief
}

export const briefSummary = (brief) =>
  brief ? { createdAt: brief.createdAt, summary: brief.summary, sources: brief.sources, mock: brief.mock } : null

/**
 * Turns one idea into a finished piece: hooks → script ⇄ quality loop → captions.
 * Used for Create Content (after Trend + Creative Director) and for every Content Plan day.
 */
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

    emit({ type: 'step', agent: qualityAgent.id, name: qualityAgent.name, status: 'running', detail: `Scoring draft ${attempt}…` })
    quality = await call(qualityAgent, { ...ctx, idea, hook, script, attempt, previousFeedback })

    // Rule checks in code, on top of the model's review.
    const ruleIssues = checkScript({ script, goal: ctx.goal, previousFeedback })
    const unfixed = quality.previous_feedback_check.filter((c) => !c.fixed)
    quality.feedback = [...ruleIssues, ...quality.feedback]
    quality.overall_score = Math.round(quality.overall_score)
    if (ruleIssues.length || unfixed.length) quality.overall_score = Math.min(quality.overall_score, PASS_SCORE - 1)
    quality.passed = quality.overall_score >= PASS_SCORE
    feedback = quality.passed ? [] : quality.feedback

    const verdict = quality.passed ? 'approved' : attempt < MAX_ATTEMPTS ? `${quality.feedback.length} points sent back` : 'still below the bar'
    emit({ type: 'step', agent: qualityAgent.id, name: qualityAgent.name, status: 'done', detail: `Score ${quality.overall_score}/10 — ${verdict}` })

    attempts.push({ attempt, score: quality.overall_score, passed: quality.passed, feedbackCount: quality.feedback.length })
    // On a tie keep the later draft: it has more feedback fixed.
    if (!best || quality.overall_score >= best.quality.overall_score) best = { script, quality, attempt }
    if (quality.passed) break
  }
  ;({ script, quality } = best)

  // Captions
  const captions = await step(captionAgent, { ...ctx, idea, hook, script }, 'Writing captions for every platform…', (c) => `${c.captions.length} platforms ready`)

  return {
    hooks: hooks.hooks,
    bestHookIndex: hookIdx,
    hookReasoning: hooks.reasoning,
    hook,
    script,
    quality: { ...quality, attempts, bestAttempt: best.attempt, passScore: PASS_SCORE, maxAttempts: MAX_ATTEMPTS },
    needsReview: !quality.passed,
    captions: captions.captions,
  }
}

/**
 * Create Content: the full Director pipeline for one video.
 * Brand DNA → Market Brief → Trends → Creative Director → Director picks → hooks/script/quality/captions → Director summary.
 */
export async function runDirector({ niche, goal, language, brandProfile, brandInputs }, emit, { signal } = {}) {
  const usage = emptyUsage()
  const { step, call } = makeStepper(emit, { signal, usage })

  const profile = await ensureBrand({ niche, goal, language, brandProfile, brandInputs }, emit, { step })
  const marketBrief = await ensureMarketBrief(niche, emit)
  const ctx = { brandProfile: profile, goal, language, niche, marketBrief }

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
    brandProfile: profile,
    marketBrief: briefSummary(marketBrief),
    ideas: trends.ideas,
    idea,
    creative: { concepts: creative.concepts, chosenIndex, reasoning: pick.reasoning, scores: pick.scores, directorNotes: pick.director_notes },
    ...piece,
    plan,
    cost: { ...usage, usd: costOf(usage) },
  }
}
