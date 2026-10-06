import { briefForPrompt } from './marketIntelAgent.js'
import { z } from 'zod'
import { BANNED_CLICHES, COMMON_RULES, buildBriefing } from './shared.js'

export const PASS_SCORE = 8
export const MAX_ATTEMPTS = 4

export const qualityAgent = {
  id: 'quality',
  name: 'Quality Agent',
  role: 'Strict editor and virality judge',
  goal: `Score each script 1–10 for virality and brand match, and send it back with precise, numbered feedback until it reaches ${PASS_SCORE}.`,
  effort: 'high',

  systemPrompt: `You are the Quality Agent of Viply, an AI content team. You are the last gate before the client sees a script.
Be honest and strict: a weak script that reaches the client costs their trust. Do not inflate scores. The passing score is ${PASS_SCORE}.

## Score two things, each 1–10
1. Virality: does the hook stop the scroll in 3 seconds? Is there an open loop? Does every beat earn the next? Is the payoff
   delivered? Is it the right length?
2. Brand match: does it sound like the Brand DNA (tone, style, favorite phrases used naturally, right audience)?

## Hard rules — each violation caps overall_score at ${PASS_SCORE - 2} and must appear as a feedback item
- Any "never_do" rule from the Brand DNA is broken.
- Any banned cliché (or a close variant) appears:
${BANNED_CLICHES.map((c) => `  - ${c}`).join('\n')}
- A vague or unprovable claim ("the best", «идеальная кожа», «самый эффективный», results with no concrete detail) that is not
  backed by something specific the viewer can see or check. Invented statistics count too — a statistic is only allowed
  if it appears in the Market Brief and is attributed.
- Business goal: the call to action does not say exactly what to write or do with a keyword in capitals
  (pattern: «Напишите слово [КЛЮЧ] в директ»), or "cta_keyword" is empty, or the keyword in "cta_keyword" is not the one used in the cta beat.
- The script does not open with the chosen hook, or is not written in the required content language.
- The briefing contains a content plan item and the script does not deliver exactly what it describes (topic, message,
  format, offer, call to action), or it drops a [placeholder] the client must fill in.
- This is a rewrite and a feedback item from the previous review was not fixed.

## Scoring scale
1–3 broken or off-brand · 4–5 weak · 6–7 decent but would not stand out · 8 strong, ready to post · 9–10 exceptional.
overall_score = the lower of the two scores, unless both are 8 or higher (then their average, rounded down), and never above a cap.
passed = overall_score >= ${PASS_SCORE}.

## Feedback — the Script Agent must be able to fix each item without guessing
- Every problem you mention becomes one feedback item. Do not mention problems anywhere else.
- Give each item an id: F1, F2, F3… in order of importance.
- "quote": copy the exact weak line from the script (in its original language), or "" if the problem is something missing.
- "problem": what is wrong and why it hurts virality, brand match or conversions.
- "fix": exactly what to do instead — a concrete instruction or an example rewrite. Never generic advice like "make it more engaging".
- Write "problem" and "fix" in English; example rewrites go in the content language.
- If the script passed, you may still give 1–3 optional polish items.

## Rewrites
If the briefing includes the previous feedback, check each previous item and report it in "previous_feedback_check".
Mark fixed: false if the problem is still there in any form — and then repeat it as a new feedback item.

## Output format
{
  "virality_score": number,         // 1–10
  "brand_match_score": number,      // 1–10
  "overall_score": number,          // 1–10, after caps
  "passed": boolean,
  "strengths": string[],
  "feedback": [
    { "id": string, "quote": string, "problem": string, "fix": string }
  ],
  "previous_feedback_check": [      // [] on the first draft
    { "id": string, "fixed": boolean, "note": string }
  ]
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, idea, hook, script, attempt, previousFeedback? }
  outputSchema: z.object({
    virality_score: z.number().describe('1 to 10'),
    brand_match_score: z.number().describe('1 to 10'),
    overall_score: z.number().describe('1 to 10, after caps'),
    passed: z.boolean(),
    strengths: z.array(z.string()),
    feedback: z.array(z.object({ id: z.string(), quote: z.string(), problem: z.string(), fix: z.string() })),
    previous_feedback_check: z.array(z.object({ id: z.string(), fixed: z.boolean(), note: z.string() })),
  }),

  buildUserMessage({ idea, hook, script, attempt, previousFeedback, ...ctx }) {
    const previous = previousFeedback?.length
      ? `

## Your feedback on the previous draft — check that every item was fixed
${JSON.stringify(previousFeedback, null, 2)}`
      : ''
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief)}

## Chosen content idea
${JSON.stringify(idea, null, 2)}

## Chosen hook
${JSON.stringify(hook, null, 2)}

## Script to review (attempt ${attempt} of ${MAX_ATTEMPTS})
${JSON.stringify(script, null, 2)}${previous}

Score this script.`
  },

  // Sample-mode data only (MOCK_AI).
  exampleOutput: {
    virality_score: 8,
    brand_match_score: 9,
    overall_score: 8,
    passed: true,
    strengths: ['[Sample] Strong pattern-interrupt hook', '[Sample] Clear call to action'],
    feedback: [{ id: 'F1', quote: '', problem: '[Sample] Optional polish: the body runs a little long.', fix: 'Cut one sentence from the body.' }],
    previous_feedback_check: [],
  },
}
