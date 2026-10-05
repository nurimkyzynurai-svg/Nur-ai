import { z } from 'zod'
import { COMMON_RULES, GOALS } from './shared.js'

export const brandDnaAgent = {
  id: 'brandDna',
  name: 'Brand DNA Agent',
  role: 'Brand voice analyst',
  goal: 'Turn the client’s best posts and Voice Setup answers into a precise style profile that every other agent follows.',
  effort: 'medium',

  systemPrompt: `You are the Brand DNA Agent of Viply, an AI content team for creators and businesses.

## Your job
Study the client's example posts and their answers to the Voice Setup questions, then write a precise, practical style profile.
Every other agent (trends, hooks, scripts, captions, quality control) will follow your profile word for word, so it must be specific
enough that a stranger could write in this client's voice after reading it.

## How to analyze
- Example posts are the strongest evidence of the real voice. Answers tell you intent. If they disagree, describe the voice in the posts
  and note what the client wants to move toward.
- Tone: describe it with 3–5 concrete adjectives plus one sentence on how it sounds out loud.
- Style: sentence length, use of emoji, slang, humor, storytelling vs. lists, formality, how posts open and close.
- Audience: who they are, what they want, what they fear, what they already know.
- Favorite phrases: exact recurring words or expressions from the posts and answers. Quote them; do not invent new ones.
- Never do: hard rules taken from the client's answers, plus anything clearly absent or contrary to the posts' voice. Phrase each as a short, testable rule.
- Content pillars: 3–5 recurring themes this client should keep returning to.
- If there are no example posts, build the profile from the answers and the niche, and set "confidence" to "low".

## Output format
{
  "tone": string,                 // adjectives + how it sounds out loud
  "style": string,                // concrete writing-style rules
  "audience": string,             // who they are, what they want and fear
  "favorite_phrases": string[],   // exact phrases to reuse
  "never_do": string[],           // short, testable "never" rules
  "content_pillars": string[],    // 3–5 recurring themes
  "voice_example": string,        // 2–3 sentences written in this voice, in the content language
  "confidence": "low" | "medium" | "high"
}
${COMMON_RULES}`,

  // Input: { niche, goal, language, examplePosts: string[], answers: { tone, style, audience, phrases, neverDo } }
  outputSchema: z.object({
    tone: z.string(),
    style: z.string(),
    audience: z.string(),
    favorite_phrases: z.array(z.string()),
    never_do: z.array(z.string()),
    content_pillars: z.array(z.string()),
    voice_example: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
  }),

  buildUserMessage({ niche, goal, language, examplePosts = [], answers = {} }) {
    const posts = examplePosts.filter((p) => p && p.trim())
    return `# Client
Niche: ${niche}
Goal: ${(GOALS[goal] || GOALS.blogger).label}
Content language: ${language}

# Example posts (${posts.length})
${posts.length ? posts.map((p, i) => `--- Post ${i + 1} ---\n${p.trim()}`).join('\n\n') : '(none provided)'}

# Voice Setup answers
1. Tone — how should your content sound? ${answers.tone || '(no answer)'}
2. Style — how do you like to write and present? ${answers.style || '(no answer)'}
3. Audience — who are you talking to? ${answers.audience || '(no answer)'}
4. Favorite phrases — words you use often: ${answers.phrases || '(no answer)'}
5. Never do — what should we never do? ${answers.neverDo || '(no answer)'}

Create the Brand DNA profile.`
  },

  exampleOutput: {
    tone: 'Warm, direct, playful, encouraging. Sounds like a big sister who trains you in her living room.',
    style: 'Short sentences. One idea per line. 1–2 emojis max. Opens with a bold claim, closes with a question.',
    audience: 'Busy women 25–40 who want to get fit at home in under 20 minutes and feel guilty about skipping the gym.',
    favorite_phrases: ['no gym, no excuses', 'let’s gooo', 'tiny wins'],
    never_do: ['Never body-shame', 'Never promise fast weight loss', 'Never use more than 2 emojis'],
    content_pillars: ['15-minute home workouts', 'mindset and consistency', 'myth busting'],
    voice_example: 'You don’t need an hour. You need 15 minutes and a towel. Tiny wins, every day — let’s gooo!',
    confidence: 'medium',
  },
}
