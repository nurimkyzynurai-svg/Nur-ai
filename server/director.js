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

  const ctx = { brandProfile: profile, goal, language, niche }

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

  // 4. Script ⇄ Quality loop: rewrite with feedback until the score is at least PASS_SCORE (max MAX_ATTEMPTS).
  let script
  let quality
  let best
  const attempts = []
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    script = await step(
      scriptAgent,
      { ...ctx, idea, hook, feedback: quality?.feedback_for_script_agent, previousScript: script },
      attempt === 1 ? 'Writing the full script…' : `Rewriting with feedback (try ${attempt} of ${MAX_ATTEMPTS})…`,
      (s) => `Draft ${attempt}: ${s.duration_seconds}s script`,
    )
    quality = await step(
      qualityAgent,
      { ...ctx, idea, hook, script, attempt },
      `Scoring draft ${attempt}…`,
      (q) => `Score ${q.overall_score}/10 — ${q.overall_score >= PASS_SCORE ? 'approved' : 'sent back to Script Agent'}`,
    )
    quality.overall_score = Math.round(quality.overall_score)
    quality.passed = quality.overall_score >= PASS_SCORE
    attempts.push({ attempt, score: quality.overall_score, passed: quality.passed })
    if (!best || quality.overall_score > best.quality.overall_score) best = { script, quality }
    if (quality.passed) break
  }
  ;({ script, quality } = best)

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
    ideas: trends.ideas,
    idea,
    hooks: hooks.hooks,
    bestHookIndex: hookIdx,
    hookReasoning: hooks.reasoning,
    script,
    quality: { ...quality, attempts },
    captions: captions.captions,
    plan,
  }
}
