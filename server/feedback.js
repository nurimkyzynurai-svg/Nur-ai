import crypto from 'node:crypto'
import { readJSON, updateJSON } from './store.js'

// Feedback storage. Today: a local JSON file (data/feedback.json).
// To move to Supabase (or any database) later, re-implement these three functions —
// nothing else in the app touches the file directly.

const FILE = 'feedback.json'
const MAX_STORED = 5000 // oldest entries are dropped beyond this, so the file can't grow without limit

// early_access comes from the "Join early access" button, not the type picker.
export const FEEDBACK_TYPES = ['idea', 'problem', 'question', 'partnership', 'early_access']
export const LIMITS = { message: 2000, email: 254, page: 200, minMessage: 5 }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validates raw input. Returns { value } or { error } with a message safe to show the user. */
export function validateFeedback(body = {}) {
  const type = String(body.type || '').toLowerCase()
  if (!FEEDBACK_TYPES.includes(type)) return { error: 'Choose a type: Idea, Problem, Question or Partnership.' }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length < LIMITS.minMessage) return { error: 'Please write a few words.' }
  if (message.length > LIMITS.message) return { error: `Please keep the message under ${LIMITS.message} characters.` }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) return { error: 'That email address doesn’t look right.' }
  const page = typeof body.page === 'string' ? body.page.slice(0, LIMITS.page) : ''
  const source = body.source === 'landing' ? 'landing' : 'dashboard'
  return { value: { type, message, email, page, source } }
}

export async function createFeedback(value) {
  const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...value, done: false, doneAt: null }
  await updateJSON(FILE, [], (list) => [entry, ...list].slice(0, MAX_STORED))
  return entry
}

/** Newest first. */
export async function listFeedback() {
  const list = await readJSON(FILE, [])
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function setFeedbackDone(id, done) {
  let found = null
  await updateJSON(FILE, [], (list) =>
    list.map((f) => {
      if (f.id !== id) return f
      found = { ...f, done: Boolean(done), doneAt: done ? new Date().toISOString() : null }
      return found
    }),
  )
  return found
}
