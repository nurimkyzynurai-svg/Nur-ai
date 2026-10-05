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

## Chosen content idea
${JSON.stringify(idea, null, 2)}

Write 5 hooks for this idea and pick the best.`
  },

  exampleOutput: {
    hooks: [
      { text: 'Stop doing crunches. Seriously.', on_screen_text: 'STOP doing crunches', visual: 'Creator mid-crunch, freezes and points at camera', technique: 'Stop doing X' },
      { text: 'You don’t need a gym. Here’s proof.', on_screen_text: 'No gym needed', visual: 'Living room with just a towel', technique: 'Bold claim' },
      { text: 'Busy mom? This one’s for you.', on_screen_text: 'Busy moms 👇', visual: 'Kids’ toys in the background', technique: 'Audience callout' },
      { text: '15 minutes did more than my 1-hour gym days.', on_screen_text: '15 min > 1 hour?', visual: 'Timer starting at 15:00', technique: 'Surprising number' },
      { text: 'The workout myth everyone still believes.', on_screen_text: 'Myth #1', visual: 'Big red X over a treadmill photo', technique: 'Curiosity gap' },
    ],
    best_hook_index: 0,
    reasoning: 'A pattern interrupt plus a direct command creates instant tension the script resolves.',
  },
}
