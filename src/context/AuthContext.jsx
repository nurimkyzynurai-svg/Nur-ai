import { createContext, useContext, useState } from 'react'

// Demo auth: accounts live in localStorage so the app runs without a backend.
// Swap these functions for real API calls when a server is added.
const USERS_KEY = 'viply_users'
const SESSION_KEY = 'viply_session'

const AuthContext = createContext(null)

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode); session stays in memory only.
  }
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readJSON(SESSION_KEY, null))

  function startSession(account) {
    const session = { name: account.name, email: account.email, plan: account.plan }
    writeJSON(SESSION_KEY, session)
    setUser(session)
  }

  async function register({ name, email, password, plan }) {
    const users = readJSON(USERS_KEY, {})
    const key = email.trim().toLowerCase()
    if (users[key]) throw new Error('An account with this email already exists.')
    const account = { name: name.trim(), email: key, plan, passwordHash: await hashPassword(password) }
    writeJSON(USERS_KEY, { ...users, [key]: account })
    startSession(account)
  }

  async function login({ email, password }) {
    const users = readJSON(USERS_KEY, {})
    const account = users[email.trim().toLowerCase()]
    if (!account || account.passwordHash !== (await hashPassword(password))) {
      throw new Error('Invalid email or password.')
    }
    startSession(account)
  }

  function logout() {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
