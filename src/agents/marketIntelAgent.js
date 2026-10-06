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
Research what is happening RIGHT NOW for one niche and write detailed research notes covering:
1. Platform algorithm and feature changes on Instagram, TikTok, YouTube (Shorts), Threads, LinkedIn and X that affect
   short-form content (reach, ranking signals, new formats, policy changes).
2. Trending content formats in this niche.
3. Trending sounds or audio in this niche (only if you find a source — sound trends change daily).
4. Trending topics and conversations in this niche.
5. New marketing and sales tactics creators and brands in this niche are using.
6. Competitor activity: what leading accounts and brands in this niche are doing now.
7. What the niche's audience is interested in or asking about.

Write the notes as short paragraphs per topic. After each claim, rely on the citations from your searches.
For every topic, say clearly when you found nothing reliable.
${RESEARCH_RULES}`,

  buildResearchMessage({ niche, today, maxSearches }) {
    return `Niche: ${niche}
Today: ${today}
Search budget: at most ${maxSearches} web searches. Cover platform changes first (they apply to every niche), then the niche-specific topics.

Research and write the notes.`
  },

  // Step 2 — turn notes + sources into the structured Market Brief (no tools).
  structureSystemPrompt: `You turn web research notes into Viply's daily Market Brief for one niche.
The brief is read by AI agents that write trend ideas, hooks and scripts, so be concrete and practical.
Sections: platform_updates, trending_formats, trending_sounds, trending_topics, marketing_tactics, competitor_activity,
audience_interests. Up to 5 items per section, most important first.
${STRUCTURE_RULES}`,

  buildStructureMessage({ niche, today, notes, sources }) {
    return `Niche: ${niche}
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
    trending_sounds: z.array(itemSchema),
    trending_topics: z.array(itemSchema),
    marketing_tactics: z.array(itemSchema),
    competitor_activity: z.array(itemSchema),
    audience_interests: z.array(itemSchema),
  }),
}

/** Compact text version of a brief that goes into other agents' prompts. */
export function briefForPrompt(brief) {
  if (!brief) {
    return `## Market Brief
No fresh Market Brief is available today. Do NOT present anything as a current trend, algorithm change or statistic.
Use evergreen formats and angles, and say "evergreen" instead of "trending".`
  }
  const lines = [`## Market Brief — researched ${brief.createdAt.slice(0, 10)} (live web research; use it, do not contradict it)`, brief.summary]
  for (const [key, label] of BRIEF_SECTIONS) {
    const items = brief[key] || []
    if (!items.length) continue
    lines.push(`\n### ${label}`)
    for (const it of items) {
      const src = it.source_ids.map((id) => brief.sources.find((s) => s.id === id)?.url).filter(Boolean)
      lines.push(`- [${it.verified ? 'verified' : 'UNVERIFIED'}] ${it.platform ? `(${it.platform}) ` : ''}${it.title}: ${it.detail}${src.length ? ` Sources: ${src.join(', ')}` : ''}`)
    }
  }
  lines.push(`
### How to use the Market Brief
- Base trend claims on these items. Prefer verified items. Only use an UNVERIFIED item if you present it as unconfirmed.
- Never state a statistic that is not in the brief. Never invent a trend that is not in the brief — say "evergreen" instead.`)
  return lines.join('\n')
}
