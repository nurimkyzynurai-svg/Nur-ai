// Landing page content. Keep it honest: list only what is built today; planned work goes in COMING_SOON.

// The agents that actually run in Viply today (see src/agents/).
export const AGENTS = [
  { name: 'Brand DNA', icon: '🧬', desc: 'Learns your voice from your best posts and five short answers, and keeps every agent on-brand.' },
  { name: 'Market Intelligence', icon: '🌐', desc: 'Researches the live web for your niche, platform and language, with source links. Unconfirmed items are marked.' },
  { name: 'Trend', icon: '📡', desc: 'Suggests 10 content ideas for your niche, built on the market brief — or marked evergreen when there is no fresh data.' },
  { name: 'Creative Director', icon: '💡', desc: 'Turns the best ideas into 3 bold concepts. It can also improve a whole campaign plan, with your approval.' },
  { name: 'Director', icon: '🎬', desc: 'Picks the strongest concept, runs the team in order and sums up the final package.' },
  { name: 'Hook', icon: '🪝', desc: 'Writes 5 hooks for the first 3 seconds and picks the strongest.' },
  { name: 'Script', icon: '📝', desc: 'Writes the full short-video script and fixes every point the reviewers send back.' },
  { name: 'Quality', icon: '🔍', desc: 'Scores each script for virality and brand match, and sends it back with specific fixes until it passes.' },
  { name: 'Market Fit', icon: '📊', desc: 'Checks the finished script against today’s market and shows why it can work now and the main risk.' },
  { name: 'Caption', icon: '✍️', desc: 'Writes captions and hashtags for TikTok, Instagram, YouTube Shorts, LinkedIn and Threads.' },
]

// Planned — not available yet. Shown in a separate, clearly labeled block.
export const COMING_SOON = [
  { name: 'Video Editor', icon: '🎞️', desc: 'Cutting, captions and pacing for your footage.' },
  { name: 'Publishing & Scheduler', icon: '🗓️', desc: 'Posting to your accounts at the times you choose. Today you post yourself.' },
  { name: 'Autopilot', icon: '⚡', desc: 'Content created and planned for you on a regular schedule.' },
  { name: 'Engagement Manager', icon: '💬', desc: 'Help with replying to comments and messages in your voice.' },
  { name: 'Visual Designer', icon: '🎨', desc: 'Thumbnails, covers and carousel images.' },
  { name: 'Analytics', icon: '📈', desc: 'Learning from your post results to improve the next ones.' },
]

// Plans and prices. Payments are not switched on yet; `soon` marks features that are planned, not built.
export const PLANS = [
  {
    id: 'start',
    name: 'Start',
    price: 97,
    tagline: 'For creators getting serious about content.',
    features: [
      { text: 'Your Brand DNA, followed by every agent' },
      { text: 'Full agent team: research, ideas, hooks, scripts, quality and market-fit checks, captions' },
      { text: 'Content Plan: execute your plan or improve it' },
      { text: 'Content calendar' },
      { text: 'Support through the in-app feedback form' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    tagline: 'For creators and businesses who post often.',
    popular: true,
    features: [
      { text: 'Everything in Start' },
      { text: 'More generations each month than Start' },
      { text: 'Priority support' },
      { text: 'Autopilot mode', soon: true },
      { text: 'Analytics', soon: true },
    ],
  },
  {
    id: 'multi',
    name: 'Multi',
    price: 349,
    tagline: 'For agencies and multi-brand teams.',
    features: [
      { text: 'Everything in Pro' },
      { text: 'Up to 5 brands', soon: true },
      { text: 'Team seats', soon: true },
      { text: 'Autopilot per brand', soon: true },
    ],
  },
]
