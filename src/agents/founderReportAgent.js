import { z } from 'zod'
import { RESEARCH_RULES, STRUCTURE_RULES, formatSources, itemSchema } from './research.js'

// Products to watch. Edit this list to change who the weekly report tracks.
export const COMPETITORS = ['Opus Clip', 'Captions', 'CapCut', 'HeyGen', 'Synthesia', 'Predis.ai', 'Jasper', 'Buffer', 'Hootsuite', 'Metricool']

export const founderReportAgent = {
  id: 'founderReport',
  name: 'Founder Report Agent',
  role: 'Market and technology analyst for the Viply founder',
  goal: 'Once a week, research AI models, competitor updates and platform API changes, and suggest concrete features Viply should add.',
  effort: 'high',

  researchSystemPrompt: `You research the market for the founder of Viply — an AI content platform where a team of AI agents researches trends and
writes hooks, scripts and captions for short-form video for creators and businesses (Blogger and Business goals, many languages,
Instagram/TikTok/YouTube/Threads/LinkedIn/X).

## Research the past 7 days (up to 30 days if the week was quiet)
1. New or updated AI models for video generation, voice/TTS/voice cloning, and image generation (releases, API availability, pricing changes).
2. Product updates from competitors: ${COMPETITORS.join(', ')}.
3. Platform API changes relevant to publishing and analytics: Instagram Graph API, TikTok Content Posting/Display API,
   YouTube Data API, Threads API, LinkedIn API, X API (new endpoints, deprecations, rate limits, policy or pricing changes).

Write detailed notes per topic. Say clearly when you found nothing reliable for a topic.
${RESEARCH_RULES}`,

  buildResearchMessage({ today, maxSearches }) {
    return `Today: ${today}
Search budget: at most ${maxSearches} web searches.

Research and write the notes.`
  },

  structureSystemPrompt: `You turn web research notes into Viply's weekly "AI & Market Report" for the founder.
Sections: ai_models (video, voice, image), competitor_updates, platform_api_changes — up to 6 items each — and suggestions.

## Suggestions for Viply
3–6 concrete things Viply should build or change, based ONLY on findings in the notes. Each says what to build, why now
(which finding), and rough effort and impact. "Integrate X model for voiceovers" is good; "improve AI" is not.
${STRUCTURE_RULES}`,

  buildStructureMessage({ today, notes, sources }) {
    return `Today: ${today}

## Research notes
${notes}

## Sources
${formatSources(sources) || '(no sources found)'}

Create the report.`
  },

  outputSchema: z.object({
    summary: z.string().describe('3–5 sentences: the most important changes this week for Viply'),
    ai_models: z.array(itemSchema.extend({ category: z.enum(['video', 'voice', 'image', 'other']) })),
    competitor_updates: z.array(itemSchema.extend({ competitor: z.string() })),
    platform_api_changes: z.array(itemSchema),
    suggestions: z.array(
      z.object({
        title: z.string(),
        why: z.string(),
        effort: z.enum(['small', 'medium', 'large']),
        impact: z.enum(['low', 'medium', 'high']),
        source_ids: z.array(z.string()),
      }),
    ),
  }),
}
