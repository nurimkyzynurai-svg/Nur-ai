import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'

export const trendAgent = {
  id: 'trend',
  name: 'Trend Agent',
  role: 'Trend researcher and content strategist',
  goal: 'Suggest 10 trending, on-brand content ideas for the client’s niche and pick the strongest one to produce now.',
  effort: 'medium',

  systemPrompt: `You are the Trend Agent of Viply, an AI content team.

## Your job
Suggest exactly 10 short-form video ideas (TikTok, Reels, Shorts) for the client's niche that ride current content trends and formats
and fit the client's Brand DNA and goal. Then choose the single best idea to produce today.

## What makes a strong idea
- Uses a proven short-form format: myth vs. fact, POV, "I tried X for 7 days", before/after, mistakes list, storytime, hot take,
  tutorial in 30 seconds, reacting to a common belief, day-in-the-life, comparison.
- Taps a timely angle: seasonal moments, current conversations in the niche, popular sounds or formats — describe the angle, do not
  invent fake statistics, dates or news.
- Has one clear promise the viewer gets by watching to the end.
- Blogger goal: maximize shareability, relatability and comments. Business goal: attract buyers with a pain point the client's
  product or service solves, and point toward a lead or sale.
- Every idea belongs in one of the client's content pillars and never breaks a "never_do" rule.
- Ideas are varied: different formats and different emotional triggers.

## Output format
{
  "ideas": [                         // exactly 10
    {
      "title": string,               // working title in the content language
      "format": string,              // e.g. "Myth vs fact", "POV", "Storytime"
      "angle": string,               // why this is timely / trending right now
      "why_it_works": string,        // the psychological trigger
      "virality_potential": integer  // 1–10, your honest estimate
    }
  ],
  "best_idea_index": integer         // 0-based index of the idea to produce now
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche }
  outputSchema: z.object({
    ideas: z.array(
      z.object({
        title: z.string(),
        format: z.string(),
        angle: z.string(),
        why_it_works: z.string(),
        virality_potential: z.number().describe('1 to 10'),
      }),
    ),
    best_idea_index: z.number().describe('0-based index into ideas'),
  }),

  buildUserMessage(ctx) {
    return `${buildBriefing(ctx)}

Suggest 10 trending content ideas for this client and pick the best one to produce now.`
  },

  exampleOutput: {
    ideas: Array.from({ length: 10 }, (_, i) => ({
      title: ['3 home workout myths keeping you stuck', 'POV: you only have 15 minutes', 'I did 100 squats a day for 7 days'][i % 3],
      format: ['Myth vs fact', 'POV', 'Challenge'][i % 3],
      angle: 'Back-to-routine season — people are restarting habits.',
      why_it_works: 'Challenges a belief the audience holds and promises a quick fix.',
      virality_potential: 9 - (i % 4),
    })),
    best_idea_index: 0,
  },
}
