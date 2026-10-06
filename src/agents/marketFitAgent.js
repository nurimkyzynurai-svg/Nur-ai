import { z } from 'zod'
import { briefForPrompt } from './marketIntelAgent.js'
import { COMMON_RULES, buildBriefing } from './shared.js'

export const MARKET_FIT_PASS = 7

export const MARKET_FIT_DIMENSIONS = [
  ['trend_alignment', 'Trend alignment'],
  ['format_saturation', 'Format freshness'],
  ['platform_fit', 'Platform fit'],
  ['timing', 'Timing'],
  ['differentiation', 'Differentiation'],
  ['goal_fit', 'Goal fit'],
]

export const marketFitAgent = {
  id: 'marketFit',
  name: 'Market Fit Agent',
  role: 'Market strategist who checks a finished script against today’s market',
  goal: 'Judge whether the script fits the market right now, name the strongest reason it can work and the main risk, and give one concrete improvement.',
  effort: 'medium',

  systemPrompt: `You are the Market Fit Agent of Viply. The script below already passed the Quality Agent (craft and brand).
Your job is different: judge how well it fits the market RIGHT NOW, using ONLY the Market Brief in the briefing
(fresh, cited web research). You have no web access and must not use outside knowledge about trends.

## Score each dimension 1–10, with one short note
- trend_alignment: does it use what is rising now (topics, formats, signals) in a way that fits this client?
- format_saturation: is the format fresh, or is it something the brief lists as saturated/overused? (10 = fresh)
- platform_fit: does it fit what the target platform's algorithm signals currently reward (length, structure, originality)?
- timing: is there a reason this works now rather than any time (season, conversation, change in the brief)?
- differentiation: how different is it from what competitors in this niche are doing, per the brief?
- goal_fit: does it serve the client's goal — views and engagement (Blogger) or sales and leads (Business)?

market_fit_score (1–10) = your overall judgement, not a plain average. 7 means it fits the market well; below 7 means
a real market problem a rewrite should fix.

## Explain it to the client
- why_now: the single strongest market reason this can work NOW, tied to specific brief items (list their source ids).
- main_risk: the main market risk (e.g. a saturated format, a platform signal it ignores, weak differentiation),
  with source ids when the brief supports it.
- improvement: ONE concrete improvement the client can make.
- rewrite_instruction: if the score is below ${MARKET_FIT_PASS}, a precise instruction for the Script Agent (what to change,
  where, and why); otherwise "".

## Rules
- The client's Brand DNA, vision and plan come first. Never suggest breaking them to chase a trend. If the briefing has a
  content plan item, your improvement must stay inside it (execution only — no new topic, offer or facts).
- Only cite source ids that appear in the brief. If an item you rely on is marked UNVERIFIED, say "unverified" in your text.
- Never promise virality, views, reach or results ("will go viral", "guaranteed"). Talk about fit and risk, not outcomes.
- Never invent statistics, competitors or trends.

## Output format
{
  "market_fit_score": number,
  "dimensions": [ { "key": "trend_alignment" | "format_saturation" | "platform_fit" | "timing" | "differentiation" | "goal_fit", "score": number, "note": string } ],
  "why_now": string,             // content language
  "why_now_source_ids": string[],
  "main_risk": string,           // content language
  "risk_source_ids": string[],
  "improvement": string,         // content language
  "rewrite_instruction": string  // English, for the Script Agent; "" if score >= ${MARKET_FIT_PASS}
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, platform, marketBrief, idea, hook, script, planDay? }
  outputSchema: z.object({
    market_fit_score: z.number().describe('1 to 10'),
    dimensions: z.array(
      z.object({
        key: z.enum(['trend_alignment', 'format_saturation', 'platform_fit', 'timing', 'differentiation', 'goal_fit']),
        score: z.number().describe('1 to 10'),
        note: z.string(),
      }),
    ),
    why_now: z.string(),
    why_now_source_ids: z.array(z.string()),
    main_risk: z.string(),
    risk_source_ids: z.array(z.string()),
    improvement: z.string(),
    rewrite_instruction: z.string(),
  }),

  buildUserMessage({ idea, hook, script, ...ctx }) {
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief, { forIdeas: true })}

## Idea
${JSON.stringify(idea, null, 2)}

## Hook
${JSON.stringify(hook, null, 2)}

## Final script
${JSON.stringify(script, null, 2)}

Judge the market fit of this script.`
  },

  // Sample-mode data only (MOCK_AI). "{niche}" and "{platform}" are filled in from the request.
  exampleOutput: {
    market_fit_score: 8,
    dimensions: [
      { key: 'trend_alignment', score: 8, note: '[Sample] Builds on a rising topic from the brief.' },
      { key: 'format_saturation', score: 7, note: '[Sample] Familiar format, but the twist keeps it fresh.' },
      { key: 'platform_fit', score: 8, note: '[Sample] Length and structure match current {platform} signals.' },
      { key: 'timing', score: 7, note: '[Sample] Ties into a conversation the brief marks as current.' },
      { key: 'differentiation', score: 8, note: '[Sample] Competitors in {niche} mostly post the plain version.' },
      { key: 'goal_fit', score: 9, note: '[Sample] The call to action matches the client’s goal.' },
    ],
    why_now: '[Sample] Audiences in {niche} are asking this question now, and {platform} currently favors content that answers it clearly.',
    why_now_source_ids: ['S1', 'S2'],
    main_risk: '[Sample] The opening format is common in {niche}; if the first seconds look generic, viewers may swipe.',
    risk_source_ids: ['S2'],
    improvement: '[Sample] Show the result in the first second, before saying anything.',
    rewrite_instruction: '',
  },
}
