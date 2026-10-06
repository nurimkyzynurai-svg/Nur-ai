import { z } from 'zod'
import { RESEARCH_RULES, STRUCTURE_RULES, formatSources, itemSchema } from './research.js'
import { BRIEF_SECTIONS } from './shared.js'

export { BRIEF_SECTIONS }


export const marketIntelAgent = {
  id: 'market',
  name: 'Market Intelligence Agent',
  role: 'Market researcher with live web access',
  goal: 'Once a day per niche, research fresh, cited market information and save it as a Market Brief that the Trend, Script and Director agents use.',
  effort: 'medium',

  // Step 1 — research with the web_search tool. Output: notes with citations.
  researchSystemPrompt: `You are the Market Intelligence Agent of Viply, an AI content team for creators and businesses.
Your research is the only fresh, real-world information the other agents get. They will trust it, so it must be accurate.

## Your job
Research what is happening RIGHT NOW for one niche, on one target platform, for an audience that speaks one language,
and write detailed research notes covering:
1. Algorithm signals and feature changes on the TARGET platform first (what it currently rewards or limits for short-form
   content: ranking signals, length, originality, new formats, policy changes). If the target is "All platforms", cover
   Instagram, TikTok, YouTube (Shorts), Threads, LinkedIn and X briefly.
2. Formats that are rising in this niche on this platform.
3. Formats that are saturated or overused in this niche (what audiences are tired of) — only with a source.
4. Trending sounds or audio in this niche (only if you find a source — sound trends change daily).
5. Trending topics and conversations in this niche, in this language's market where possible.
6. New marketing and sales tactics creators and brands in this niche are using.
7. Competitor activity: what leading accounts and brands in this niche are doing now.
8. What the niche's audience is interested in or asking about.
Sources in the content language are welcome — they often show the local market best.

Write the notes as short paragraphs per topic. After each claim, rely on the citations from your searches.
For every topic, say clearly when you found nothing reliable.
${RESEARCH_RULES}`,

  buildResearchMessage({ niche, nicheDescription, platform, language, today, maxSearches }) {
    return `Niche: ${niche}
${nicheDescription ? `How one client describes this niche (context only — this brief is shared by every client in the niche, so research the niche broadly, not this one business): ${nicheDescription}\n` : ''}Target platform: ${platform}
Audience language / market: ${language}
Today: ${today}
Search budget: at most ${maxSearches} web searches. Cover the target platform's algorithm signals first, then the niche-specific topics.

Research and write the notes.`
  },

  // Step 2 — turn notes + sources into the structured Market Brief (no tools).
  structureSystemPrompt: `You turn web research notes into Viply's daily Market Brief for one niche.
The brief is read by AI agents that write trend ideas, hooks and scripts, so be concrete and practical.
Sections: platform_updates (algorithm signals), trending_formats (rising), saturated_formats (overused), trending_sounds,
trending_topics, marketing_tactics, competitor_activity, audience_interests. Up to 5 items per section, most important first.
${STRUCTURE_RULES}`,

  buildStructureMessage({ niche, platform, language, today, notes, sources }) {
    return `Niche: ${niche}
Target platform: ${platform}
Audience language / market: ${language}
Today: ${today}

## Research notes
${notes}

## Sources
${formatSources(sources) || '(no sources found)'}

Create the Market Brief.`
  },

  outputSchema: z.object({
    summary: z.string().describe('3–4 sentences: the most important things a creator in this niche should know today'),
    platform_updates: z.array(itemSchema),
    trending_formats: z.array(itemSchema),
    saturated_formats: z.array(itemSchema),
    trending_sounds: z.array(itemSchema),
    trending_topics: z.array(itemSchema),
    marketing_tactics: z.array(itemSchema),
    competitor_activity: z.array(itemSchema),
    audience_interests: z.array(itemSchema),
  }),
}

const MAX_ITEMS = 3
const COMPACT_SECTIONS = [
  ['platform_updates', 'Algorithm signals'],
  ['trending_formats', 'Rising formats'],
  ['saturated_formats', 'Saturated / overused formats — avoid, or flip with a clear twist'],
  ['marketing_tactics', 'Current tactics'],
]
const IDEA_SECTIONS = [
  ['trending_topics', 'Topics people are talking about'],
  ['audience_interests', 'Audience interests'],
]

/**
 * Compact Market Brief for agent prompts: algorithm signals, rising formats, saturated formats and current tactics
 * (plus topics and audience interests for agents that generate ideas). Sources are referenced by id ([S3]).
 */
export function briefForPrompt(brief, { forIdeas = false } = {}) {
  if (!brief) {
    return `## Market data unavailable
There is no fresh market research for this niche today. Do NOT present anything as a current trend, algorithm change or
statistic. Use evergreen formats and angles, and say "evergreen" instead of "trending".`
  }
  const lines = [
    `## Market Brief (compact) — ${brief.platform || 'All platforms'}, researched ${brief.createdAt.slice(0, 10)} from live web sources`,
    brief.summary,
  ]
  for (const [key, label] of forIdeas ? [...COMPACT_SECTIONS, ...IDEA_SECTIONS] : COMPACT_SECTIONS) {
    const items = (brief[key] || []).slice(0, MAX_ITEMS)
    if (!items.length) continue
    lines.push(`\n### ${label}`)
    for (const it of items) {
      const ids = it.source_ids.length ? ` [${it.source_ids.join(', ')}]` : ''
      lines.push(`- ${it.verified ? '' : 'UNVERIFIED: '}${it.title} — ${it.detail}${ids}`)
    }
  }
  lines.push(`
### How to use the Market Brief
- It is CONTEXT, not orders. The client's Brand DNA, vision and plan always come first; never bend them to chase a trend.
- Never copy a trend blindly: use a signal only when it fits this client, and make it their own.
- Prefer verified items. Present anything marked UNVERIFIED as unconfirmed, never as fact.
- Never state a statistic unless it is in the brief, and then attribute it. Never invent a trend — say "evergreen" instead.
- Never promise virality, reach or results.`)
  return lines.join('\n')
}
