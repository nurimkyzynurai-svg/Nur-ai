import { z } from 'zod'
import { briefForPrompt } from './marketIntelAgent.js'
import { COMMON_RULES, buildBriefing } from './shared.js'

const CREATIVE_MINDSET = `
## How you think
- Start from the audience's real emotions, frustrations, desires and inside jokes in this niche — not from the product.
- Look for the unexpected: an angle the audience hasn't seen, a familiar format turned inside out, a surprising
  comparison, a tension or contradiction, a character, a mini-story, a visual metaphor, a challenge, a confession.
- Ask: "What would every competitor in this niche post?" Then do something they would not think of.
- Story beats information: give the viewer someone to root for, a moment of tension and a satisfying turn.
- Bold does not mean random: every concept must serve the client's goal and fit their Brand DNA exactly.
  Never break a "never_do" rule, never invent facts, offers, prices or results, and keep it filmable by this client.`

export const creativeDirectorAgent = {
  id: 'creative',
  name: 'Creative Director Agent',
  role: 'Bold creative director',
  goal: 'Turn the best trend ideas into 3 original, emotionally strong creative concepts that competitors would not think of.',
  effort: 'high',

  systemPrompt: `You are the Creative Director Agent of Viply, an AI content team for creators, businesses, agencies and marketing teams
in any niche, industry and language.

## Your job
The Trend Agent found ideas. Take the strongest of them and develop exactly 3 creative concepts for one short-form video.
The three must be clearly different from each other (different angle, format and emotional core) — not three versions of one idea.
${CREATIVE_MINDSET}

## Output format
{
  "concepts": [                      // exactly 3
    {
      "title": string,               // content language
      "based_on_idea_index": number, // which trend idea (0-based) it develops
      "big_idea": string,            // the concept in 1–2 sentences
      "angle": string,               // the unexpected angle and why competitors would not do it
      "format": string,              // e.g. mini-drama, reverse tutorial, POV, challenge, confession, visual metaphor
      "emotional_core": string,      // the main emotion and why the audience will feel it
      "story": string,               // the beats: setup → tension → turn → payoff, in 3–5 short lines
      "visual_signature": string,    // the one memorable visual that makes it recognizable
      "purpose": "views" | "engagement" | "sales",
      "brand_fit": string,           // how it follows the Brand DNA (tone, audience, never_do)
      "risk": string                 // what could go wrong and how to avoid it
    }
  ],
  "recommended_index": number,       // 0-based, your own pick
  "reasoning": string
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, marketBrief, ideas }
  outputSchema: z.object({
    concepts: z.array(
      z.object({
        title: z.string(),
        based_on_idea_index: z.number(),
        big_idea: z.string(),
        angle: z.string(),
        format: z.string(),
        emotional_core: z.string(),
        story: z.string(),
        visual_signature: z.string(),
        purpose: z.enum(['views', 'engagement', 'sales']),
        brand_fit: z.string(),
        risk: z.string(),
      }),
    ),
    recommended_index: z.number(),
    reasoning: z.string(),
  }),

  buildUserMessage({ ideas, ...ctx }) {
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief)}

## Trend Agent ideas (0-based)
${JSON.stringify(ideas, null, 2)}

Develop 3 bold, original creative concepts.`
  },

  // Sample-mode data only (MOCK_AI). "{niche}" is replaced with the client's niche.
  exampleOutput: {
    concepts: [0, 1, 2].map((i) => ({
      title: `[Sample concept ${i + 1}] An unexpected take on {niche}`,
      based_on_idea_index: i,
      big_idea: '[Sample] Placeholder big idea — real runs create an original concept.',
      angle: '[Sample] Placeholder angle competitors would not use.',
      format: ['Mini-drama', 'Reverse tutorial', 'Confession'][i],
      emotional_core: ['Surprise', 'Relief', 'Belonging'][i],
      story: '[Sample] Setup → tension → turn → payoff.',
      visual_signature: '[Sample] One memorable visual.',
      purpose: ['views', 'engagement', 'sales'][i],
      brand_fit: '[Sample] Matches the Brand DNA tone and audience.',
      risk: '[Sample] Keep it short so the payoff lands.',
    })),
    recommended_index: 0,
    reasoning: '[Sample] Placeholder reasoning.',
  },
}

export const CAMPAIGN_PHASES = ['warm-up', 'teaser', 'main moment', 'social proof', 'follow-up']

export const planImproverAgent = {
  id: 'planImprover',
  name: 'Creative Director Agent',
  role: 'Creative director and campaign strategist',
  goal: 'Improve a client’s content plan into a campaign that builds to the key date, and explain every change.',
  effort: 'high',

  systemPrompt: `You are the Creative Director Agent of Viply in campaign mode. A client (a creator, business, agency or marketing team,
in any niche and language) gave you their content plan and asked you to IMPROVE it.

## Your job
Turn their plan into a stronger campaign while keeping their vision. Think in campaign arcs that fit the campaign goal
(product launch, event, sale, brand awareness, personal brand growth, or anything else):
- warm-up: make the audience care about the problem or topic before anything is announced;
- teaser: build curiosity and anticipation toward the key date;
- main moment: the key date itself — the launch, event, sale or big reveal — with the clearest call to action;
- social proof: show real reactions, results, questions or behind-the-scenes that make others want in;
- follow-up: last chance, thank-you, recap, lessons, next step — keep the momentum after the key date.
Use only the phases that make sense for this goal and timeline. Vary formats so consecutive days don't feel the same.
${CREATIVE_MINDSET}

## Respect the client (non-negotiable)
- Keep every idea of theirs that works. Improve wording, angle, format and timing only where it makes the campaign stronger.
- Days marked "locked" must stay EXACTLY as written, on the same date.
- Never move or weaken the key date's main moment.
- Never invent offers, prices, discounts, dates, features, results, testimonials or statistics. If a day needs something only the
  client has (a real review, a price, a guest's name), write the day with a clear placeholder in square brackets, e.g.
  "[add a real customer quote here]", and say so in the reason.
- Stay within the date window given in the briefing and keep at most one item per date.
- Do not inflate the plan: add a day only when it clearly strengthens the arc, and say why.

## Output format
{
  "strategy_summary": string,       // 3–5 sentences: the campaign arc and why it will work for this goal
  "phases": [ { "name": string, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "purpose": string } ],
  "days": [                          // the full improved plan, one item per date, sorted by date
    {
      "date": "YYYY-MM-DD",
      "content": string,             // what to post that day — clear enough to film or write from (content language)
      "format": string,              // e.g. Reel, carousel, story, live, post, short
      "platform": string,            // "" if any platform
      "phase": string,               // one of the phase names above
      "change": "kept" | "improved" | "new" | "moved",
      "original_date": string,       // for "moved": the date it came from; otherwise ""
      "reason": string               // why you made this change (or why it was kept as is)
    }
  ],
  "removed": [ { "original_date": string, "reason": string } ]  // client days you dropped (rare) and why
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, marketBrief, plan, window }
  outputSchema: z.object({
    strategy_summary: z.string(),
    phases: z.array(z.object({ name: z.string(), start_date: z.string(), end_date: z.string(), purpose: z.string() })),
    days: z.array(
      z.object({
        date: z.string(),
        content: z.string(),
        format: z.string(),
        platform: z.string(),
        phase: z.string(),
        change: z.enum(['kept', 'improved', 'new', 'moved']),
        original_date: z.string(),
        reason: z.string(),
      }),
    ),
    removed: z.array(z.object({ original_date: z.string(), reason: z.string() })),
  }),

  buildUserMessage({ plan, window, ...ctx }) {
    return `${buildBriefing(ctx)}

${briefForPrompt(ctx.marketBrief)}

## The client's content plan
Campaign: ${plan.name}
Campaign goal: ${plan.campaignGoal}
Start date: ${plan.startDate}
Key date: ${plan.keyDate}${plan.keyDateLabel ? ` — ${plan.keyDateLabel}` : ''}
Allowed date window: ${window.from} to ${window.to}

### Client's vision
${plan.vision || '(none given)'}

### Client's notes
${plan.notes || '(none given)'}

### Days
${plan.days.map((d) => `- ${d.date}${d.locked ? ' [LOCKED — keep exactly]' : ''}${d.platform ? ` [${d.platform}]` : ''}${d.format ? ` [${d.format}]` : ''}: ${d.content}`).join('\n')}

Improve this plan.`
  },
}
