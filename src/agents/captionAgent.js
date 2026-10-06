import { z } from 'zod'
import { COMMON_RULES, buildBriefing } from './shared.js'

export const PLATFORMS = ['TikTok', 'Instagram', 'YouTube Shorts', 'LinkedIn', 'Threads']

export const captionAgent = {
  id: 'caption',
  name: 'Caption Agent',
  role: 'Platform-native caption and hashtag writer',
  goal: 'Write a caption and hashtags for each platform that match its culture, the client’s voice and the goal.',
  effort: 'medium',

  systemPrompt: `You are the Caption Agent of Viply, an AI content team.

## Your job
Write a caption and hashtags for the final script on each of these platforms: ${PLATFORMS.join(', ')}.

## Platform rules
- TikTok: 1–2 short lines that add to the hook (do not repeat it), a question to drive comments. 3–5 hashtags.
- Instagram: first line is a second hook (it shows before "more"). Short paragraphs, line breaks, a save/share prompt. 5–10 hashtags
  mixing broad, niche and community tags.
- YouTube Shorts: searchable title-style first line with the main keyword. 2–3 hashtags.
- LinkedIn: professional but still in the client's voice; lesson or insight framing; no hashtag spam (max 3).
- Threads: conversational, one strong opinion or question, max 1–2 hashtags.

## Goal
- Blogger: drive comments, saves, shares and follows.
- Business: one clear conversion step (DM keyword, link in bio, book a call). Never more than one call to action.

## Rules
- Hashtags are written without spaces, start with "#", and fit the content language and niche (local-language tags where the audience
  uses them, plus English tags only if the audience uses them).
- Follow the Brand DNA strictly, including emoji habits and "never_do".

## Output format
{
  "captions": [
    {
      "platform": string,        // one of: ${PLATFORMS.join(', ')}
      "caption": string,         // content language
      "hashtags": string[],
      "cta": string              // the call to action used
    }
  ]
}
${COMMON_RULES}`,

  // Input: { brandProfile, goal, language, niche, idea, hook, script }
  outputSchema: z.object({
    captions: z.array(
      z.object({
        platform: z.string(),
        caption: z.string(),
        hashtags: z.array(z.string()),
        cta: z.string(),
      }),
    ),
  }),

  buildUserMessage({ idea, hook, script, ...ctx }) {
    return `${buildBriefing(ctx)}

## Content idea
${JSON.stringify(idea, null, 2)}

## Hook
${JSON.stringify(hook, null, 2)}

## Final script
${JSON.stringify(script, null, 2)}

Write captions and hashtags for every platform.`
  },

  // Sample-mode data only (MOCK_AI). "{niche}" is replaced with the client's niche.
  exampleOutput: {
    captions: PLATFORMS.map((platform) => ({
      platform,
      caption: `[Sample ${platform} caption] Which of these surprised you about {niche}? 👀`,
      hashtags: ['#sample', '#yourniche', '#example'],
      cta: 'Comment your answer',
    })),
  },
}
