import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { readJSON, updateJSON } from './store.js'

// Accounts and sessions. Today: local JSON files (data/users.json, data/sessions.json).
// To move to Supabase (or any database) later, re-implement the functions in this file.

const scrypt = promisify(crypto.scrypt)
const USERS = 'users.json'
const SESSIONS = 'sessions.json'
const SESSION_DAYS = 30
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PLAN_IDS = ['start', 'pro', 'multi']

const normEmail = (e) => String(e || '').trim().toLowerCase()
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64)
  return `${salt}:${key.toString('hex')}`
}

async function checkPassword(password, stored) {
  const [salt, hex] = String(stored || '').split(':')
  if (!salt || !hex) return false
  const key = await scrypt(password, salt, 64)
  const expected = Buffer.from(hex, 'hex')
  return expected.length === key.length && crypto.timingSafeEqual(expected, key)
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, plan: u.plan })

export function validateRegistration({ name, email, password, plan } = {}) {
  name = String(name || '').trim()
  email = normEmail(email)
  if (!name || name.length > 80) return { error: 'Please enter your name (up to 80 characters).' }
  if (!EMAIL.test(email) || email.length > 254) return { error: 'Please enter a valid email address.' }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return { error: 'Password must be at least 8 characters.' }
  return { value: { name, email, password, plan: PLAN_IDS.includes(plan) ? plan : 'pro' } }
}

export async function registerUser({ name, email, password, plan }) {
  const passwordHash = await hashPassword(password)
  let created = null
  await updateJSON(USERS, {}, (users) => {
    if (users[email]) return users
    created = { id: crypto.randomUUID(), name, email, plan, passwordHash, createdAt: new Date().toISOString() }
    return { ...users, [email]: created }
  })
  if (!created) throw Object.assign(new Error('An account with this email already exists. Log in instead.'), { status: 409 })
  return publicUser(created)
}

export async function verifyLogin(email, password) {
  const users = await readJSON(USERS, {})
  const user = users[normEmail(email)]
  // Run the hash even when the user doesn't exist, so timing doesn't reveal which emails are registered.
  const ok = await checkPassword(String(password || ''), user?.passwordHash || 'x:00')
  return ok && user ? publicUser(user) : null
}

/** Creates a session; only a hash of the token is stored on the server. */
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  await updateJSON(SESSIONS, {}, (sessions) => {
    const now = new Date().toISOString()
    const live = Object.fromEntries(Object.entries(sessions).filter(([, s]) => s.expiresAt > now))
    return { ...live, [sha256(token)]: { userId, expiresAt } }
  })
  return token
}

export async function userFromToken(token) {
  if (!token) return null
  const session = (await readJSON(SESSIONS, {}))[sha256(token)]
  if (!session || session.expiresAt < new Date().toISOString()) return null
  const users = await readJSON(USERS, {})
  const user = Object.values(users).find((u) => u.id === session.userId)
  return user ? publicUser(user) : null
}

export async function deleteSession(token) {
  if (!token) return
  await updateJSON(SESSIONS, {}, (sessions) => {
    const { [sha256(token)]: _removed, ...rest } = sessions
    return rest
  })
}
