import { z } from 'zod'
import { AGENT_VALUES } from './values.js'

// Shared pieces for agents that research the live web (Market Intelligence, Founder Report).

export const RESEARCH_RULES = `${AGENT_VALUES}

## Research rules (non-negotiable)
1. Use the web_search tool. Never rely only on your memory for anything that changes over time — trends, algorithm
   changes, product launches, prices. If you could not find a source, say so; do not fill the gap from memory.
2. Cite every finding. Each claim must come from a page you found in this session.
3. Prefer primary and recent sources: official platform newsrooms and help centers, company blogs and changelogs,
   then reputable trade press. Note the publication date when you can see it. Prefer the last 30 days.
4. Mark anything unverified: rumors, single low-quality sources, "leaks", or claims you could only find secondhand.
5. Never invent statistics, percentages, dates, user numbers or quotes. Only report a number if a source states it,
   and attribute it ("according to …").
6. Stay within the search budget you are given. Plan your searches so each one covers a different topic.`

export const STRUCTURE_RULES = `${AGENT_VALUES}

## Structuring rules (non-negotiable)
- You are given research notes and a numbered source list (S1, S2, …). Use ONLY what is in the notes.
  Do not add facts, examples or numbers from your own memory.
- Every item lists the ids of the sources that support it in "source_ids". Use only ids from the list.
- "verified" is true only when the item is supported by at least one credible source in the list and the notes did not flag
  it as uncertain. Rumors, leaks, single weak sources, or anything the notes call unconfirmed → verified: false.
- Keep numbers exactly as the notes state them, with attribution. If an item has a number with no source, drop the number.
- "date_seen": the publication date of the main source if the notes give it (YYYY-MM-DD or "Month YYYY"), else "".
- If a section has nothing reliable, return an empty list for it. An empty section is better than a guess.
- Write in clear, plain English.`

export const itemSchema = z.object({
  title: z.string(),
  detail: z.string().describe('2–3 sentences: what changed or what is trending, and why it matters'),
  platform: z.string().describe('Instagram, TikTok, YouTube, Threads, LinkedIn, X, or "" if not platform-specific'),
  source_ids: z.array(z.string()).describe('ids like "S3" from the source list'),
  verified: z.boolean(),
  date_seen: z.string(),
})

export function formatSources(sources) {
  return sources.map((s) => `${s.id}: ${s.title || 'Untitled'} — ${s.url}${s.pageAge ? ` (published ${s.pageAge})` : ''}`).join('\n')
}
