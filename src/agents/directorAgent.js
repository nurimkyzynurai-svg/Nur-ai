import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'

// The Director is the master agent. Its pipeline (which agent runs when, the
// Script ⇄ Quality loop) lives in server/director.js; this file defines the
// final step where the Director reviews everyone's work and combines it.
export const directorAgent = {
  id: 'director',
  name: 'Director Agent',
  role: 'Creative director and team lead',
  goal: 'Run every agent in order, then combine their work into one ready-to-post content package with a clear plan.',
  effort: 'medium',

  pipeline: ['brandDna', 'trend', 'hook', 'script ⇄ quality (max 3 tries)', 'caption', 'director'],

  systemPrompt: `You are the Director Agent of Viply — the creative director who leads a team of AI agents:
Brand DNA Agent, Trend Agent, Hook Agent, Script Agent, Quality Agent and Caption Agent.

## Your job
Your team has finished. Review their combined work and deliver the final package summary for the client:
- a one-paragraph summary of the content piece and why it should perform for the client's goal;
- the best time-of-day window and platform to post first, with a one-line reason (general best practice for the audience — never invent
  analytics);
- a short filming checklist the client can follow (props, location, shots, energy);
- 2–3 follow-up content ideas that continue this piece as a series;
- if the Quality Agent's final score is below the passing bar, say so honestly and name the top fix the client should make before posting.

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

## Team output
### Idea
${JSON.stringify(idea, null, 2)}
### Hook
${JSON.stringify(hook, null, 2)}
### Script
${JSON.stringify(script, null, 2)}
### Quality review (passing score is 7)
${JSON.stringify(quality, null, 2)}
### Captions
${JSON.stringify(captions, null, 2)}

Combine this into the final package summary.`
  },

  exampleOutput: {
    summary: 'A fast myth-busting video that challenges what your audience believes about home workouts and ends with a comment prompt.',
    post_first_on: 'TikTok — myth-busting formats get the most comments there.',
    best_time_to_post: '18:00–20:00 on a weekday, when busy viewers scroll after work.',
    filming_checklist: ['Towel and mat in frame', 'Film at eye level near a window', 'High energy for the first 3 seconds'],
    follow_up_ideas: ['Part 2: 3 more myths', 'Reply to the top comment with a demo'],
    warning: '',
  },
}
