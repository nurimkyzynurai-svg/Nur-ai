// localStorage helpers that never throw (private mode, blocked storage).
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}

export const brandKey = (email) => `viply_brand_${email}`
export const dashboardKey = (email) => `viply_dashboard_${email}`
export const plansKey = (email) => `viply_plans_${email}`

/** Adds or replaces calendar posts (by id) in the Overview calendar. */
export function upsertCalendarPosts(email, posts) {
  const state = load(dashboardKey(email), { niche: '', autopilot: false, posts: [] })
  const ids = new Set(posts.map((p) => p.id))
  save(dashboardKey(email), { ...state, posts: [...state.posts.filter((p) => !ids.has(p.id)), ...posts] })
}

export function removeCalendarPosts(email, predicate) {
  const state = load(dashboardKey(email), { niche: '', autopilot: false, posts: [] })
  save(dashboardKey(email), { ...state, posts: state.posts.filter((p) => !predicate(p)) })
}
