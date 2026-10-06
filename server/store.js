import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Tiny JSON-file store. Data lives in /data (git-ignored).
// Swap for a real database when Viply has one.
export const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

const locks = new Map()

async function withLock(file, fn) {
  const prev = locks.get(file) || Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(file, next.catch(() => {}))
  return next
}

export async function readJSON(name, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

export async function writeJSON(name, value) {
  const file = path.join(DATA_DIR, name)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2))
  await fs.rename(tmp, file)
}

/** Read-modify-write a JSON file safely (one writer at a time per file). */
export function updateJSON(name, fallback, fn) {
  return withLock(name, async () => {
    const next = await fn(await readJSON(name, fallback))
    await writeJSON(name, next)
    return next
  })
}
