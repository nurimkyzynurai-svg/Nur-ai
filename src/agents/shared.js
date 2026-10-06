// Shared definitions for every Viply agent.
// These files contain prompts and schemas only — no secrets. They are run by the
// backend (server/), which is the only place the Anthropic API key is read.

import { AGENT_VALUES } from './values.js'

export const MODEL = 'claude-sonnet-5-5'

export const GOALS = {
  blogger: {
    label: 'Blogger',
    metrics: 'views, followers and engagement',
    strategy:
      'Optimize for reach and community. Favor curiosity, relatability, emotion, shareability and saves. ' +
      'Calls to action ask people to follow, comment, share or save. Never sound like an ad.',
  },
  business: {
    label: 'Business',
    metrics: 'sales and leads',
    strategy:
      'Optimize for conversions. Lead with the customer’s pain or desire, show proof and the result the product delivers, ' +
      'handle one objection, and end with ONE call to action that says exactly what to write or do, including a keyword ' +
      '(pattern: «Напишите слово [КЛЮЧ] в директ» / "Comment [KEYWORD] and I’ll send you [the offer]", with a keyword that fits the offer). ' +
      'Still entertain first — value before the pitch, no hard-sell clichés.',
  },
}

// Phrases that make content sound generic. Agents must never use them, and the
// server rejects any script that contains one (see server/checks.js).
export const BANNED_CLICHES = [
  // Russian
  'кожа дышит',
  'эффект вау',
  'вау-эффект',
  'уникальная формула',
  'уникальное предложение',
  'премиальное качество',
  'качество премиум-класса',
  'лучшее соотношение цены и качества',
  'индивидуальный подход',
  'команда профессионалов',
  'мы работаем для вас',
  'не упустите шанс',
  'успейте купить',
  'в современном мире',
  'ни для кого не секрет',
  'жизнь заиграет новыми красками',
  'выйти на новый уровень',
  'с любовью к своему делу',
  // English
  'game-changer',
  'game changer',
  'next level',
  'unlock your potential',
  'in today’s fast-paced world',
  "in today's fast-paced world",
  'look no further',
  'best in class',
  'high-quality products',
  'one-stop shop',
  'you won’t believe',
  "you won't believe",
]

// Sections of the daily Market Brief (see marketIntelAgent.js).
export const BRIEF_SECTIONS = [
  ['platform_updates', 'Algorithm signals & platform changes'],
  ['trending_formats', 'Rising formats'],
  ['saturated_formats', 'Saturated / overused formats'],
  ['trending_sounds', 'Trending sounds & audio'],
  ['trending_topics', 'Trending topics in the niche'],
  ['marketing_tactics', 'New marketing & sales tactics'],
  ['competitor_activity', 'Competitor activity'],
  ['audience_interests', 'Audience interests'],
]

// Platforms a client can target. "All platforms" is used when a plan day names none.
export const TARGET_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Threads', 'LinkedIn', 'X']
export const ANY_PLATFORM = 'All platforms'

export const LANGUAGES = ['English', 'Russian', 'Kazakh', 'Spanish', 'Turkish', 'Uzbek', 'German', 'French', 'Portuguese', 'Arabic']

// Rules appended to every agent's system prompt.
export const COMMON_RULES = `${AGENT_VALUES}

## Rules that apply to every Viply agent
1. BRAND DNA IS LAW. Every briefing contains the client's Brand DNA profile. Follow it strictly:
   - match the tone, style and sentence rhythm it describes;
   - reuse the client's favorite phrases naturally where they fit (never force all of them in);
   - write for the exact audience it describes;
   - NEVER do anything listed in "never_do" — not even partially. If a request conflicts with "never_do", "never_do" wins.
2. GOAL. The briefing names the client's goal (Blogger or Business) and the strategy for it. Shape every decision around that goal.
3. LANGUAGE. Write ALL client-facing text (ideas, hooks, scripts, captions, hashtags, feedback) in the content language given in the briefing.
   Use natural, native phrasing — not a word-for-word translation. JSON keys stay in English.
4. Be original. Never copy existing creators' content; build on patterns, not on their words.
5. Respond only with the JSON object described in your output format.`

export function buildBriefing({ brandProfile, goal, language, niche, platform, planDay }) {
  const g = GOALS[goal] || GOALS.blogger
  return `# Client briefing
Niche: ${niche}
Target platform: ${platform || ANY_PLATFORM}
Content language: ${language}
Goal: ${g.label} — success is measured in ${g.metrics}.
Goal strategy: ${g.strategy}

## Brand DNA profile (follow strictly)
${JSON.stringify(brandProfile, null, 2)}${planDay ? `\n\n${planSection(planDay)}` : ''}`
}

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000)

/** The client's content plan item. Used when a Content Plan day is being produced. */
export function planSection({ campaign, day }) {
  const diff = daysBetween(day.date, campaign.keyDate)
  const timing = diff === 0 ? 'this IS the key date' : diff > 0 ? `${diff} day(s) before the key date` : `${-diff} day(s) after the key date`
  return `## Content plan item from the client — RESPECT IT
Campaign: ${campaign.name}
Campaign goal: ${campaign.campaignGoal}
Key date: ${campaign.keyDate}${campaign.keyDateLabel ? ` — ${campaign.keyDateLabel}` : ''}
Client's vision: ${campaign.vision || '(none given)'}
Client's notes: ${campaign.notes || '(none given)'}

### Today's item — ${day.date} (${timing})${day.phase ? `, campaign phase: ${day.phase}` : ''}
${day.content}${day.platform ? `\nPlatform: ${day.platform}` : ''}${day.format ? `\nFormat: ${day.format}` : ''}

### Rules for plan items
- This item IS the idea. Do not change its topic, message, angle, format, offer, call to action or facts.
- Your job is execution only: make it an excellent piece of content exactly as described — wording, hook, pacing, shots, captions.
- Fill gaps with execution details, never with new claims. Text in [square brackets] is a placeholder for the client — keep it.
- If the item names a platform, format or call to action, use exactly that.`
}
