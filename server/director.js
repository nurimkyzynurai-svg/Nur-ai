import {
  brandDnaAgent,
  trendAgent,
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
import { getFreshBrief, trackNiche } from './marketIntel.js'

/**
 * The Director pipeline. Runs every agent in order and reports progress through `emit`:
 *   { type: 'step', agent, status: 'running' | 'done' | 'skipped', detail }
 * Returns the combined content package.
 */
export async function runDirector({ niche, goal, language, brandProfile, brandInputs }, emit, { signal } = {}) {
  const step = async (agent, input, detail, summarize) => {
    emit({ type: 'step', agent: agent.id, name: agent.name, status: 'running', detail })
    const out = await runAgent(agent, input, { signal })
    emit({ type: 'step', agent: agent.id, name: agent.name, status: 'done', detail: summarize(out) })
    return out
  }

  // 1. Brand DNA — reuse the saved profile when the client already has one.
  let profile = brandProfile
  if (profile) {
    emit({ type: 'step', agent: brandDnaAgent.id, name: brandDnaAgent.name, status: 'skipped', detail: 'Using your saved Brand DNA profile' })
  } else {
    profile = await step(
      brandDnaAgent,
      { niche, goal, language, ...brandInputs },
      'Analyzing your posts and answers…',
      (p) => `Tone: ${p.tone}`,
    )
    emit({ type: 'brandProfile', profile })
  }

  // Market Intelligence: today's cited Market Brief for this niche (cached for 24 hours).
  await trackNiche(niche)
  emit({ type: 'step', agent: 'market', name: 'Market Intelligence Agent', status: 'running', detail: 'Checking today’s Market Brief…' })
  const market = await getFreshBrief(niche, {
    onResearch: (max) =>
      emit({ type: 'step', agent: 'market', name: 'Market Intelligence Agent', status: 'running', detail: `Researching the web (up to ${max} searches)…` }),
  })
  const marketBrief = market.brief
  emit({
    type: 'step',
    agent: 'market',
    name: 'Market Intelligence Agent',
    status: marketBrief ? (market.cached ? 'skipped' : 'done') : 'done',
    detail: marketBrief
      ? `${market.cached ? 'Using' : 'New'} brief from ${marketBrief.createdAt.slice(0, 10)} · ${marketBrief.sources.length} sources${market.error ? ' (refresh failed — older brief)' : ''}`
      : 'No brief available — agents will use evergreen ideas only',
  })

  const ctx = { brandProfile: profile, goal, language, niche, marketBrief }

  // 2. Trends
  const trends = await step(trendAgent, ctx, 'Finding 10 trending ideas…', (t) => `${t.ideas.length} ideas found`)
  const bestIdx = Math.min(Math.max(Math.round(trends.best_idea_index) || 0, 0), trends.ideas.length - 1)
  if (!trends.ideas.length) throw new Error("Trend Agent returned no ideas. Try again.")
  const idea = trends.ideas[bestIdx]

  // 3. Hooks
  const hooks = await step(hookAgent, { ...ctx, idea }, `Writing hooks for “${idea.title}”…`, (h) => `${h.hooks.length} hooks written`)
  const hookIdx = Math.min(Math.max(Math.round(hooks.best_hook_index) || 0, 0), hooks.hooks.length - 1)
  if (!hooks.hooks.length) throw new Error("Hook Agent returned no hooks. Try again.")
  const hook = hooks.hooks[hookIdx]

  // 4. Script ⇄ Quality loop: the Script Agent rewrites with feedback until the draft
  //    scores at least PASS_SCORE, for up to MAX_ATTEMPTS drafts. The best draft wins.
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
    quality = await runAgent(qualityAgent, { ...ctx, idea, hook, script, attempt, previousFeedback }, { signal })

    // Rule checks in code, on top of the model's review.
    const ruleIssues = checkScript({ script, goal, previousFeedback })
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
  const needsReview = !quality.passed

  // 5. Captions
  const captions = await step(captionAgent, { ...ctx, idea, hook, script }, 'Writing captions for every platform…', (c) => `${c.captions.length} platforms ready`)

  // 6. Director combines everything.
  const plan = await step(
    directorAgent,
    { ...ctx, idea, hook, script, quality, captions: captions.captions },
    'Reviewing the team’s work…',
    () => 'Final package ready',
  )

  return {
    niche,
    goal,
    language,
    brandProfile: profile,
    marketBrief: marketBrief
      ? { createdAt: marketBrief.createdAt, summary: marketBrief.summary, sources: marketBrief.sources, mock: marketBrief.mock }
      : null,
    ideas: trends.ideas,
    idea,
    hooks: hooks.hooks,
    bestHookIndex: hookIdx,
    hookReasoning: hooks.reasoning,
    script,
    quality: { ...quality, attempts, bestAttempt: best.attempt, passScore: PASS_SCORE, maxAttempts: MAX_ATTEMPTS },
    needsReview,
    captions: captions.captions,
    plan,
  }
}
