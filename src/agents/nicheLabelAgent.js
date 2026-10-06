import { z } from 'zod'
import { AGENT_VALUES } from './values.js'

// Turns a client's niche description (often dictated) into a short label (1–5 words) for the UI
// and for the shared market-brief cache. The full description is what the content agents use.
export const nicheLabelAgent = {
  id: 'nicheLabel',
  name: 'Niche Label',
  role: 'Names a niche in a few words',
  goal: 'Give a short, specific, searchable label for the client’s niche.',
  effort: 'low',

  systemPrompt: `You name a client's niche for Viply, an AI content team for creators and businesses in any niche and language.

## Your job
Read the client's description of what they sell or create, for whom and where, and return a short label of 1 to 5 words.
- Specific enough to research the market with (e.g. a product category + audience or place), not a slogan.
- In the same language the client wrote in.
- No brand names unless the description is only about that brand, no emojis, no quotes, no punctuation at the end.
- The description may be dictated: ignore filler words and recognition errors.
${AGENT_VALUES}

## Output format
{ "label": string }`,

  outputSchema: z.object({ label: z.string() }),

  buildUserMessage({ description }) {
    return `Niche description:\n${description}\n\nReturn the short label.`
  },

  exampleOutput: { label: '' }, // sample mode uses fallbackNicheLabel instead
}

/** Simple fallback (no AI): the first few meaningful words of the description. */
export function fallbackNicheLabel(description) {
  const words = String(description || '')
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words.slice(0, 4).join(' ')
}

/** Cleans any label: trims, removes quotes and trailing punctuation, max 5 words / 60 characters. */
export function cleanNicheLabel(label) {
  return String(label || '')
    .replace(/["«»“”]/g, '')
    .replace(/[.!?,;:]+$/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .slice(0, 60)
}
