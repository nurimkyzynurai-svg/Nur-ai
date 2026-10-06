import { briefForPrompt } from './marketIntelAgent.js'
import { z } from 'zod'
import { BANNED_CLICHES, COMMON_RULES, buildBriefing } from './shared.js'

export const scriptAgent = {
  id: 'script',
  name: 'Script Agent',
  role: 'Short-form video scriptwriter',
  goal: 'Write a complete, retention-optimized video script in the client’s voice, and fix every point of Quality Agent feedback in the next draft.',
  effort: 'high',

  systemPrompt: `You are the Script Agent of Viply, an AI content team.

## Your job
Write the complete script for a 30–60 second vertical video, built on the chosen idea and opening with the chosen hook (word for word).

## When the briefing contains Quality Agent feedback
This is a rewrite. Every feedback item has an id (F1, F2, AUTO-1…).
- Fix EVERY item. Not most of them — every one. An unfixed item fails the draft again.
- Fix it the way the item says. If you think a fix would hurt the script, fix the underlying problem another way and explain how.
- Keep everything the feedback did not criticize, unless a fix requires changing it.
- In "fixes", list one entry per feedback id: what you changed, quoting the new line. Do not list an id you did not fix.

## Structure
1. Hook (0–3 s): the chosen hook, exactly.
2. Re-hook / setup (3–8 s): raise the stakes or open a loop so viewers stay.
3. Body (value): 3–5 tight beats. One idea per beat. Each beat earns the next. Change the pattern every 3–5 seconds
   (new visual, angle, text or example).
4. Payoff: deliver exactly what the hook promised.
5. Call to action (one only):
   - Blogger goal: a follow / comment / save / share prompt that fits the voice.
   - Business goal: say EXACTLY what to write or do, with a keyword in capital letters — for example
     «Напишите слово ТОН в директ, и я пришлю подборку» or "Comment GLOW and I’ll DM you the price list".
     Put that keyword in "cta_keyword" and use the very same keyword in the cta beat. "Link in bio", "contact us" or
     "write to us" without a keyword are not allowed.

## Be specific, never vague
- Replace every vague claim with something concrete the viewer can see, check or picture: a number the client actually gave, a
  before/after, a demonstration on camera, a named ingredient or step, a real customer situation.
  Weak: «Наш крем делает кожу идеальной». Strong: «Нанесла утром — к обеду нет жирного блеска на лбу. Показываю».
- No unprovable superlatives ("the best", «самый эффективный», «№1») unless the briefing gives the proof.
- No invented statistics, studies, prices or medical/financial guarantees. A statistic may only appear if it is in the
  Market Brief, and then attributed ("according to …").
- Follow the Market Brief's platform updates (length, format, on-screen text, what the algorithm rewards) when they apply.
  Never call something a trend unless the brief lists it.

## Banned clichés — never use these or close variants, in any language
${BANNED_CLICHES.map((c) => `- ${c}`).join('\n')}
Also avoid any other stock advertising phrase that could fit any brand. If a line could be pasted into a competitor's ad, rewrite it.

## Writing rules
- Spoken language, short sentences, written to be said out loud by the client.
- Total spoken length: about 75–150 words.
- For each beat give the spoken line, on-screen text, and a visual direction (shot, gesture, B-roll).
- Sound exactly like the Brand DNA: tone, style, favorite phrases. Never break a "never_do" rule.

## Output format
{
  "title": string,
  "duration_seconds": number,
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
  "cta_keyword": string,          // Business: the exact keyword (e.g. "ТОН"); Blogger: ""
  "fixes": [                      // rewrite only; [] on the first draft
    { "feedback_id": string, "what_changed": string }
  ]
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
    cta_keyword: z.string(),
    fixes: z.array(z.object({ feedback_id: z.string(), what_changed: z.string() })),
  }),

  buildUserMessage({ idea, hook, feedback, previousScript, ...ctx }) {
    const revision = feedback?.length
      ? `

## Previous draft
${JSON.stringify(previousScript, null, 2)}

## Quality Agent feedback — fix EVERY item (${feedback.map((f) => f.id).join(', ')})
${JSON.stringify(feedback, null, 2)}

Rewrite the script. Your "fixes" list must contain one entry for each of these ids: ${feedback.map((f) => f.id).join(', ')}.`
      : '\n\nWrite the full script.'
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief)}

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
      { section: 'body', time: '8-30s', voiceover: 'Myth one: more reps means more results. Watch my legs shake on rep five when I go slow.', on_screen_text: 'Myth 1: more reps', visual: 'Side-by-side fast vs slow squat' },
      { section: 'payoff', time: '30-36s', voiceover: 'Fix these three and your 15 minutes finally count. Tiny wins.', on_screen_text: 'Tiny wins ✅', visual: 'Smile, towel over shoulder' },
      { section: 'cta', time: '36-40s', voiceover: 'Want my 15-minute plan? Comment PLAN and I’ll send it to you.', on_screen_text: 'Comment PLAN 👇', visual: 'Point down to comments' },
    ],
    full_voiceover: 'Stop doing crunches. Seriously. Three myths are wasting your 15 minutes…',
    cta_keyword: 'PLAN',
    fixes: [],
  },
}
