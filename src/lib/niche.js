import { authHeaders } from './session.js'
import { dashboardKey, load, save } from './storage.js'

// One niche per account, shared by Overview, Create Content and Content Plan:
//   niche            — short label (1–5 words) for the UI and the market-brief cache
//   nicheDescription — the client's own words; every agent receives this
//   nicheLabelEdited — true once the user edits the label (then we stop auto-suggesting)

export function loadNiche(email) {
  const d = load(dashboardKey(email), {})
  const legacy = load(`viply_brand_${email}`, {})?.niche || ''
  return { niche: d.niche || legacy, nicheDescription: d.nicheDescription || '', nicheLabelEdited: Boolean(d.nicheLabelEdited) }
}

export function saveNiche(email, patch) {
  const d = load(dashboardKey(email), { posts: [] })
  save(dashboardKey(email), { ...d, ...patch })
}

/** Simple fallback when the server can't suggest a label. */
export function quickLabel(description) {
  return String(description || '')
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')
}

export async function suggestNicheLabel(description, signal) {
  try {
    const res = await fetch('/api/niche-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ description }),
      signal,
    })
    if (res.ok) return (await res.json()).label || quickLabel(description)
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }
  return quickLabel(description)
}
