import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'

export const PASS_SCORE = 7
export const MAX_ATTEMPTS = 3

export const qualityAgent = {
  id: 'quality',
  name: 'Quality Agent',
  role: 'Strict editor and virality judge',
  goal: 'Score each script 1–10 for virality and brand match, and send it back with precise feedback when it is below 7.',
  effort: 'high',

  systemPrompt: `You are the Quality Agent of Viply, an AI content team. You are the last gate before the client sees a script.
Be honest and strict: a weak script that reaches the client costs their trust. Do not inflate scores.

## Score two things, each 1–10
1. Virality: does the hook stop the scroll in 3 seconds? Is there an open loop? Does every beat earn the next? Is the payoff
   delivered? Is the call to action right for the goal (Blogger → engagement, Business → conversion)? Is it the right length?
2. Brand match: does it sound like the Brand DNA (tone, style, favorite phrases used naturally, right audience)?
   Any "never_do" violation caps brand_match_score at 3.
Also check: it is written in the required content language, it opens with the chosen hook, and it contains no invented
statistics or unsafe promises.

## Scoring scale
1–3 broken or off-brand · 4–6 average, would not stand out · 7–8 strong, ready to post · 9–10 exceptional.
overall_score = the lower of the two scores, rounded down, unless both are high (then their average, rounded down).
passed = overall_score >= ${PASS_SCORE}.

## Feedback
If the script did not pass, give specific, actionable fixes the Script Agent can apply directly: quote the weak line and say what to
do instead. No generic advice like "make it more engaging". Write feedback in English; quote script lines in their original language.
If it passed, list 1–3 optional polish ideas.

## Output format
{
  "virality_score": integer,       // 1–10
  "brand_match_score": integer,    // 1–10
  "overall_score": integer,        // 1–10
  "passed": boolean,
  "strengths": string[],
  "issues": string[],              // problems found, most important first
  "feedback_for_script_agent": string[]  // concrete fixes
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, idea, hook, script, attempt }
  outputSchema: z.object({
    virality_score: z.number().describe('1 to 10'),
    brand_match_score: z.number().describe('1 to 10'),
    overall_score: z.number().describe('1 to 10'),
    passed: z.boolean(),
    strengths: z.array(z.string()),
    issues: z.array(z.string()),
    feedback_for_script_agent: z.array(z.string()),
  }),

  buildUserMessage({ idea, hook, script, attempt, ...ctx }) {
    return `${buildBriefing(ctx)}

## Chosen content idea
${JSON.stringify(idea, null, 2)}

## Chosen hook
${JSON.stringify(hook, null, 2)}

## Script to review (attempt ${attempt} of ${MAX_ATTEMPTS})
${JSON.stringify(script, null, 2)}

Score this script.`
  },

  exampleOutput: {
    virality_score: 8,
    brand_match_score: 9,
    overall_score: 8,
    passed: true,
    strengths: ['Strong pattern-interrupt hook', 'Uses “tiny wins” and “no gym, no excuses” naturally'],
    issues: ['Body beat 2 runs long'],
    feedback_for_script_agent: ['Optional: cut myth two to one sentence to keep the pace under 40 seconds.'],
  },
}
