import { briefForPrompt } from './marketIntelAgent.js'
import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'

export const hookAgent = {
  id: 'hook',
  name: 'Hook Agent',
  role: 'Scroll-stopping hook writer',
  goal: 'Write 5 hooks that stop the scroll in the first 3 seconds and pick the strongest.',
  effort: 'medium',

  systemPrompt: `You are the Hook Agent of Viply, an AI content team.

## Your job
For the chosen content idea, write exactly 5 different hooks for the first 3 seconds of a short-form video, then pick the best.

## Hook rules
- Spoken in under 3 seconds: 12 words or fewer.
- Each hook uses a different technique: bold claim, curiosity gap, direct callout of the audience, pattern interrupt,
  relatable pain, controversial take, surprising number, or "stop doing X".
- Add a matching on-screen text line (even shorter) and one visual action for the first frame.
- The hook must be paid off by the video — no clickbait the script can't deliver.
- Blogger goal: aim for curiosity, emotion and comments. Business goal: call out the buyer's pain or desire.
- If the idea contains a "creative_concept" from the Creative Director (and "director_notes"), the hooks must open THAT concept —
  its angle, emotional core and visual signature.
- Use the Market Brief's algorithm signals and rising formats as context; avoid saturated hook styles unless you flip them.
- Sound exactly like the client's Brand DNA. Never break a "never_do" rule.

## Output format
{
  "hooks": [                      // exactly 5
    {
      "text": string,             // spoken hook, content language
      "on_screen_text": string,   // short overlay text, content language
      "visual": string,           // what the viewer sees in the first frame
      "technique": string         // technique name, in English
    }
  ],
  "best_hook_index": integer,     // 0-based
  "reasoning": string             // one sentence: why that hook wins
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, idea }
  outputSchema: z.object({
    hooks: z.array(
      z.object({
        text: z.string(),
        on_screen_text: z.string(),
        visual: z.string(),
        technique: z.string(),
      }),
    ),
    best_hook_index: z.number(),
    reasoning: z.string(),
  }),

  buildUserMessage({ idea, ...ctx }) {
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief)}

## Chosen content idea
${JSON.stringify(idea, null, 2)}

Write 5 hooks for this idea and pick the best.`
  },

  // Sample-mode data only (MOCK_AI). "{niche}" is replaced with the client's niche.
  exampleOutput: {
    hooks: [
      { text: '[Sample] Stop believing this about {niche}.', on_screen_text: 'STOP', visual: 'Direct look into camera', technique: 'Stop doing X' },
      { text: '[Sample] Here is proof it works differently.', on_screen_text: 'Proof', visual: 'Show the result first', technique: 'Bold claim' },
      { text: '[Sample] If you care about {niche}, watch this.', on_screen_text: 'For you 👇', visual: 'Point at camera', technique: 'Audience callout' },
      { text: '[Sample] One change made the biggest difference.', on_screen_text: '1 change', visual: 'Hold up one finger', technique: 'Curiosity gap' },
      { text: '[Sample] The mistake almost everyone makes.', on_screen_text: 'Mistake #1', visual: 'Big red X on screen', technique: 'Relatable pain' },
    ],
    best_hook_index: 0,
    reasoning: '[Sample] A direct command creates tension the script resolves.',
  },
}
