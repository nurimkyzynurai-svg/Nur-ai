import { briefForPrompt } from './marketIntelAgent.js'
import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'
import { PASS_SCORE } from './qualityAgent.js'

// The Director is the master agent. Its pipeline (which agent runs when, the
// Script ⇄ Quality loop) lives in server/director.js; this file defines the
// final step where the Director reviews everyone's work and combines it.
export const directorAgent = {
  id: 'director',
  name: 'Director Agent',
  role: 'Creative director and team lead',
  goal: 'Run every agent in order, then combine their work into one ready-to-post content package with a clear plan.',
  effort: 'medium',

  pipeline: ['brandDna', 'trend', 'hook', 'script ⇄ quality (max 4 tries, pass at 8)', 'caption', 'director'],

  systemPrompt: `You are the Director Agent of Viply — the creative director who leads a team of AI agents:
Brand DNA Agent, Trend Agent, Hook Agent, Script Agent, Quality Agent and Caption Agent.

## Your job
Your team has finished. Review their combined work and deliver the final package summary for the client:
- a one-paragraph summary of the content piece and why it should perform for the client's goal;
- the best time-of-day window and platform to post first, with a one-line reason. Use the Market Brief's platform updates when they
  apply; otherwise give general best practice for the audience and say so — never invent analytics;
- a short filming checklist the client can follow (props, location, shots, energy);
- 2–3 follow-up content ideas that continue this piece as a series;
- if the Quality Agent's final score is below ${PASS_SCORE}, the script NEEDS REVIEW: say so honestly in "warning" and name the top 1–3 fixes
  (from the Quality Agent's feedback) the client should make before posting.

Address the client directly ("you"), in the content language, in their Brand DNA voice.

## Output format
{
  "summary": string,
  "post_first_on": string,
  "best_time_to_post": string,
  "filming_checklist": string[],
  "follow_up_ideas": string[],
  "warning": string             // "" if the script passed quality control
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, idea, hook, script, quality, captions }
  outputSchema: z.object({
    summary: z.string(),
    post_first_on: z.string(),
    best_time_to_post: z.string(),
    filming_checklist: z.array(z.string()),
    follow_up_ideas: z.array(z.string()),
    warning: z.string(),
  }),

  buildUserMessage({ idea, hook, script, quality, captions, ...ctx }) {
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief)}

## Team output
### Idea
${JSON.stringify(idea, null, 2)}
### Hook
${JSON.stringify(hook, null, 2)}
### Script
${JSON.stringify(script, null, 2)}
### Quality review (passing score is ${PASS_SCORE})
${JSON.stringify(quality, null, 2)}
### Captions
${JSON.stringify(captions, null, 2)}

Combine this into the final package summary.`
  },

  // Sample-mode data only (MOCK_AI). "{niche}" is replaced with the client's niche.
  exampleOutput: {
    summary: '[Sample] A fast myth-busting video for {niche} that ends with a comment prompt.',
    post_first_on: '[Sample] TikTok — placeholder reason.',
    best_time_to_post: '[Sample] Evening on a weekday — placeholder.',
    filming_checklist: ['[Sample] Good light', '[Sample] Eye-level camera', '[Sample] High energy in the first 3 seconds'],
    follow_up_ideas: ['[Sample] Part 2', '[Sample] Reply to the top comment'],
    warning: '',
  },
}

// The Director's judging step: picks the strongest of the Creative Director's 3 concepts.
export const conceptPickAgent = {
  id: 'directorPick',
  name: 'Director Agent',
  role: 'Creative director and team lead',
  goal: 'Pick the strongest of the Creative Director’s 3 concepts for this client and goal.',
  effort: 'medium',

  systemPrompt: `You are the Director Agent of Viply — the team lead who makes the final creative call.
The Creative Director proposed 3 concepts for one short-form video. Pick the one most likely to win for THIS client.

## Judge each concept on
1. Originality — would competitors in this niche think of it? Generic concepts lose.
2. Emotional pull — will the audience feel something in the first seconds and stay to the end?
3. Goal fit — does it serve the client's goal (views and engagement, or sales and leads)?
4. Brand fit — does it match the Brand DNA exactly and break no "never_do" rule?
5. Feasibility and honesty — can this client film it, and does it avoid inventing facts, offers or results?

Be decisive: pick one. You may add up to 3 short "director_notes" that sharpen it (what to keep, what to push further).

## Output format
{
  "chosen_index": number,          // 0-based
  "scores": [ { "index": number, "originality": number, "emotion": number, "goal_fit": number, "brand_fit": number, "feasibility": number } ],
  "reasoning": string,             // why this concept wins, in 2–3 sentences
  "director_notes": string[]
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, concepts }
  outputSchema: z.object({
    chosen_index: z.number(),
    scores: z.array(
      z.object({ index: z.number(), originality: z.number(), emotion: z.number(), goal_fit: z.number(), brand_fit: z.number(), feasibility: z.number() }),
    ),
    reasoning: z.string(),
    director_notes: z.array(z.string()),
  }),

  buildUserMessage({ concepts, ...ctx }) {
    return `${buildBriefing(ctx)}

## The Creative Director's 3 concepts (0-based)
${JSON.stringify(concepts, null, 2)}

Pick the strongest concept.`
  },

  // Sample-mode data only (MOCK_AI).
  exampleOutput: {
    chosen_index: 0,
    scores: [0, 1, 2].map((index) => ({ index, originality: 8 - index, emotion: 8, goal_fit: 8, brand_fit: 9, feasibility: 8 })),
    reasoning: '[Sample] Placeholder reasoning for the pick.',
    director_notes: ['[Sample] Keep the opening visual.'],
  },
}
