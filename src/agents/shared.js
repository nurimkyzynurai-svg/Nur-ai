// Shared definitions for every Viply agent.
// These files contain prompts and schemas only — no secrets. They are run by the
// backend (server/), which is the only place the Anthropic API key is read.

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
      'handle one objection, and end with one clear call to action (DM a keyword, link in bio, book a call, buy). ' +
      'Still entertain first — value before the pitch, no hard-sell clichés.',
  },
}

export const LANGUAGES = ['English', 'Russian', 'Kazakh', 'Spanish', 'Turkish', 'Uzbek', 'German', 'French', 'Portuguese', 'Arabic']

// Rules appended to every agent's system prompt.
export const COMMON_RULES = `
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

export function buildBriefing({ brandProfile, goal, language, niche }) {
  const g = GOALS[goal] || GOALS.blogger
  return `# Client briefing
Niche: ${niche}
Content language: ${language}
Goal: ${g.label} — success is measured in ${g.metrics}.
Goal strategy: ${g.strategy}

## Brand DNA profile (follow strictly)
${JSON.stringify(brandProfile, null, 2)}`
}
