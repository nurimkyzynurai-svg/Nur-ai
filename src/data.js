export const AGENTS = [
  { name: 'Trend Scout', icon: '📡', desc: 'Scans TikTok, Reels and Shorts around the clock to catch rising trends in your niche before they peak.' },
  { name: 'Hook Writer', icon: '🪝', desc: 'Crafts scroll-stopping opening lines tested against millions of high-performing posts.' },
  { name: 'Script Architect', icon: '📝', desc: 'Turns ideas into tight, retention-optimized scripts with a clear story arc and call to action.' },
  { name: 'Caption Crafter', icon: '✍️', desc: 'Writes on-brand captions tailored to each platform’s tone, length and algorithm.' },
  { name: 'Hashtag Strategist', icon: '#️⃣', desc: 'Picks the perfect mix of broad, niche and trending hashtags to maximize reach.' },
  { name: 'Visual Designer', icon: '🎨', desc: 'Generates thumbnails, carousels and cover images that match your brand kit.' },
  { name: 'Video Editor', icon: '🎬', desc: 'Cuts, captions and paces short-form video with auto B-roll, zooms and music sync.' },
  { name: 'Scheduler', icon: '🗓️', desc: 'Publishes at the exact moments your audience is most active, on every platform.' },
  { name: 'Engagement Manager', icon: '💬', desc: 'Replies to comments and DMs in your voice to keep the algorithm — and your fans — happy.' },
  { name: 'Analytics Coach', icon: '📈', desc: 'Learns from every post and feeds insights back to the other agents so you grow faster each week.' },
]

export const PLANS = [
  {
    id: 'start',
    name: 'Start',
    price: 97,
    tagline: 'For creators getting serious about growth.',
    features: ['1 brand / niche', '30 AI posts per month', '5 core AI agents', '2 connected platforms', 'Content calendar', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    tagline: 'Full autopilot for ambitious creators.',
    popular: true,
    features: ['1 brand / niche', 'Unlimited AI posts', 'All 10 AI agents', 'All platforms', 'Autopilot mode', 'Advanced analytics', 'Priority support'],
  },
  {
    id: 'multi',
    name: 'Multi',
    price: 349,
    tagline: 'For agencies and multi-brand creators.',
    features: ['Up to 5 brands / niches', 'Unlimited AI posts', 'All 10 AI agents', 'All platforms', 'Autopilot per brand', 'Team seats (5)', 'Dedicated success manager'],
  },
]
