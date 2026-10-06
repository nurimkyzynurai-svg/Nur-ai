import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authHeaders, getSession, setSession } from '../lib/session.js'

// Accounts live on the Viply server (data/users.json). The browser keeps only the session token.
const AuthContext = createContext(null)

async function call(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body || {}) })
  } catch {
    throw new Error('Cannot reach the Viply server. Please try again in a moment.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`)
  return data
}

export function AuthProvider({ children }) {
  const [session, setState] = useState(() => getSession())
  const [usage, setUsage] = useState(null)
  const user = session?.user || null

  const save = (next) => {
    setSession(next)
    setState(next)
  }

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {})
    setSession(null)
    setState(null)
    setUsage(null)
  }, [])

  const refreshUsage = useCallback(async () => {
    if (!getSession()) return
    try {
      const res = await fetch('/api/usage', { headers: authHeaders() })
      if (res.status === 401) return logout()
      if (res.ok) setUsage(await res.json())
    } catch {
      // server unreachable — keep the last known usage
    }
  }, [logout])

  useEffect(() => {
    refreshUsage()
    const onSignedOut = () => logout()
    window.addEventListener('viply:signed-out', onSignedOut)
    return () => window.removeEventListener('viply:signed-out', onSignedOut)
  }, [refreshUsage, logout])

  async function register({ name, email, password, plan }) {
    const data = await call('/api/auth/register', { name, email, password, plan })
    save({ token: data.token, user: data.user })
    setUsage(data.usage)
  }

  async function login({ email, password }) {
    const data = await call('/api/auth/login', { email, password })
    save({ token: data.token, user: data.user })
    setUsage(data.usage)
  }

  return <AuthContext.Provider value={{ user, usage, setUsage, refreshUsage, register, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
