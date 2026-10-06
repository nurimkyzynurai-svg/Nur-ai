import { readJSON, updateJSON } from './store.js'

// Free-generation limit, counted on the server per account (data/usage.json).
// One Create Content run = 1 generation. Each produced Content Plan day = 1 generation.
// Emails in VITE_ADMIN_EMAILS (the founder/team) have no limit.

const FILE = 'usage.json'
const num = (v, d) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : d)
export const FREE_GENERATIONS = num(process.env.FREE_GENERATIONS, 3)

const adminEmails = () =>
  String(process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

const reserved = new Map() // userId -> generations currently running (not yet counted)

export async function getUsage(user) {
  const unlimited = adminEmails().includes(user.email)
  const used = (await readJSON(FILE, {}))[user.id]?.used || 0
  const pending = reserved.get(user.id) || 0
  return { used, limit: FREE_GENERATIONS, remaining: unlimited ? null : Math.max(0, FREE_GENERATIONS - used - pending), unlimited }
}

export class LimitError extends Error {
  constructor(message, usage) {
    super(message)
    this.code = 'FREE_LIMIT_REACHED'
    this.usage = usage
  }
}

/**
 * Reserves n generations before work starts, so two requests at once can't go over the limit.
 * Returns { commit(k), release() }: commit counts finished generations, release frees the rest.
 */
export async function reserve(user, n) {
  const usage = await getUsage(user)
  if (!usage.unlimited && usage.remaining < n) {
    const message =
      usage.remaining === 0
        ? `You’ve used your ${FREE_GENERATIONS} free generations. Join early access to keep creating — founding members lock in their price.`
        : `This needs ${n} generations, but you have ${usage.remaining} free generation${usage.remaining === 1 ? '' : 's'} left. Choose fewer days, or join early access.`
    throw new LimitError(message, usage)
  }
  reserved.set(user.id, (reserved.get(user.id) || 0) + n)
  let open = n
  return {
    async commit(k = 1) {
      const take = Math.min(k, open)
      if (take <= 0) return
      open -= take
      reserved.set(user.id, Math.max(0, (reserved.get(user.id) || 0) - take))
      await updateJSON(FILE, {}, (all) => ({ ...all, [user.id]: { used: (all[user.id]?.used || 0) + take, updatedAt: new Date().toISOString() } }))
    },
    release() {
      reserved.set(user.id, Math.max(0, (reserved.get(user.id) || 0) - open))
      open = 0
    },
  }
}
