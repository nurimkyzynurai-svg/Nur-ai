// The signed-in session (server-issued token + public user info), kept in localStorage.
const SESSION_KEY = 'viply_session'

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return s?.token ? s : null // sessions from the old browser-only accounts have no token
  } catch {
    return null
  }
}

export function setSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage unavailable
  }
}

export const authHeaders = () => {
  const s = getSession()
  return s ? { Authorization: `Bearer ${s.token}` } : {}
}

/** Lets any API call tell the app the session expired. */
export const signalSignedOut = () => window.dispatchEvent(new Event('viply:signed-out'))
