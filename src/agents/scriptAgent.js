import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'

export const scriptAgent = {
  id: 'script',
  name: 'Script Agent',
  role: 'Short-form video scriptwriter',
  goal: 'Write a complete, retention-optimized video script in the client’s voice, and rewrite it when the Quality Agent sends feedback.',
  effort: 'high',

  systemPrompt: `You are the Script Agent of Viply, an AI content team.

## Your job
Write the complete script for a 30–60 second vertical video, built on the chosen idea and opening with the chosen hook (word for word).
If the briefing includes feedback from the Quality Agent on a previous draft, fix every point in it while keeping what worked.

## Structure
1. Hook (0–3 s): the chosen hook, exactly.
2. Re-hook / setup (3–8 s): raise the stakes or open a loop so viewers stay.
3. Body (value): 3–5 tight beats. One idea per beat. Each beat earns the next. Use pattern changes every 3–5 seconds
   (new visual, angle, text, or example).
4. Payoff: deliver exactly what the hook promised.
5. Call to action: Blogger goal → follow / comment / save / share prompt that fits the voice.
   Business goal → one concrete conversion step (DM a keyword, link in bio, book a call).

## Writing rules
- Spoken language, short sentences, written to be said out loud by the client.
- Total spoken length: about 75–150 words.
- For each beat give the spoken line, on-screen text, and a visual direction (shot, gesture, B-roll).
- Sound exactly like the Brand DNA: tone, style, favorite phrases. Never break a "never_do" rule.
- No invented statistics, studies or medical/financial guarantees.

## Output format
{
  "title": string,
  "duration_seconds": integer,
  "beats": [
    {
      "section": "hook" | "setup" | "body" | "payoff" | "cta",
      "time": string,             // e.g. "0-3s"
      "voiceover": string,        // spoken line, content language
      "on_screen_text": string,   // overlay, content language
      "visual": string            // direction for filming / editing
    }
  ],
  "full_voiceover": string,       // the whole spoken script as one text
  "changes_made": string          // if feedback was given: what you changed; otherwise ""
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, idea, hook, feedback?, previousScript? }
  outputSchema: z.object({
    title: z.string(),
    duration_seconds: z.number(),
    beats: z.array(
      z.object({
        section: z.enum(['hook', 'setup', 'body', 'payoff', 'cta']),
        time: z.string(),
        voiceover: z.string(),
        on_screen_text: z.string(),
        visual: z.string(),
      }),
    ),
    full_voiceover: z.string(),
    changes_made: z.string(),
  }),

  buildUserMessage({ idea, hook, feedback, previousScript, ...ctx }) {
    const revision = feedback
      ? `

## Previous draft
${JSON.stringify(previousScript, null, 2)}

## Feedback from the Quality Agent (fix every point)
${JSON.stringify(feedback, null, 2)}

Rewrite the script.`
      : '\n\nWrite the full script.'
    return `${buildBriefing(ctx)}

## Chosen content idea
${JSON.stringify(idea, null, 2)}

## Chosen hook (open with this exactly)
${JSON.stringify(hook, null, 2)}${revision}`
  },

  exampleOutput: {
    title: '3 home workout myths keeping you stuck',
    duration_seconds: 40,
    beats: [
      { section: 'hook', time: '0-3s', voiceover: 'Stop doing crunches. Seriously.', on_screen_text: 'STOP doing crunches', visual: 'Freeze mid-crunch, point at camera' },
      { section: 'setup', time: '3-8s', voiceover: 'Three myths are wasting your 15 minutes. Number three hurt me the most.', on_screen_text: '3 myths', visual: 'Hold up three fingers' },
      { section: 'body', time: '8-30s', voiceover: 'Myth one: more reps means more results. Nope — slow reps win…', on_screen_text: 'Myth 1: more reps', visual: 'Side-by-side fast vs slow squat' },
      { section: 'payoff', time: '30-36s', voiceover: 'Fix these three and your 15 minutes finally count. Tiny wins.', on_screen_text: 'Tiny wins ✅', visual: 'Smile, towel over shoulder' },
      { section: 'cta', time: '36-40s', voiceover: 'Which myth did you believe? Tell me below — no gym, no excuses.', on_screen_text: 'Comment your myth 👇', visual: 'Point down to comments' },
    ],
    full_voiceover: 'Stop doing crunches. Seriously. Three myths are wasting your 15 minutes…',
    changes_made: '',
  },
}
