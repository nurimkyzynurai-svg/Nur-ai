import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ANY_PLATFORM, GOALS, TARGET_PLATFORMS } from '../src/agents/index.js'
import { runDirector } from './director.js'
import { cleanPlan, runPlanGenerate, runPlanImprove } from './plan.js'
import crypto from 'node:crypto'
import { createFeedback, listFeedback, setFeedbackDone, validateFeedback } from './feedback.js'
import { rateLimit } from './rateLimit.js'
import { createSession, deleteSession, registerUser, userFromToken, validateRegistration, verifyLogin } from './users.js'
import { getUsage, LimitError, reserve } from './usage.js'
import { friendlyError, MOCK } from './claude.js'
import { comboOf, listBriefs, overview, runBrief, runFounderReport, startScheduler, trackCombo } from './marketIntel.js'

const app = express()
// Behind a reverse proxy (hosting platform), set TRUST_PROXY=true so rate limits see the real client IP.
app.set('trust proxy', process.env.TRUST_PROXY === 'true')
app.use(express.json({ limit: '200kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mock: MOCK, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) })
})

// ---------- Accounts ----------
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many sign-ups from your network. Please try again later.' })
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many login attempts. Please wait a few minutes.' })
const bearer = (req) => (String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/) || [])[1]

async function requireUser(req, res, next) {
  try {
    const user = await userFromToken(bearer(req))
    if (!user) return res.status(401).json({ error: 'Please log in again.', code: 'AUTH_REQUIRED' })
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

app.post('/api/auth/register', registerLimiter, async (req, res) => {
  const { value, error } = validateRegistration(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const user = await registerUser(value)
    res.status(201).json({ user, token: await createSession(user.id), usage: await getUsage(user) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not create the account.' })
  }
})

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const user = await verifyLogin(req.body?.email, req.body?.password)
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' })
  res.json({ user, token: await createSession(user.id), usage: await getUsage(user) })
})

app.get('/api/auth/me', requireUser, async (req, res) => {
  res.json({ user: req.user, usage: await getUsage(req.user) })
})

app.post('/api/auth/logout', async (req, res) => {
  await deleteSession(bearer(req))
  res.json({ ok: true })
})

app.get('/api/usage', requireUser, async (req, res) => {
  res.json(await getUsage(req.user))
})

const limitResponse = (res, err) => res.status(403).json({ error: err.message, code: err.code, usage: err.usage })

// Reads the fields every content request shares. Returns an error message or the clean input.
function readContentRequest(body = {}) {
  const { niche, goal, language, platform, brandProfile, brandInputs } = body
  if (typeof niche !== 'string' || !niche.trim() || niche.length > 200) return { error: 'Please enter your niche (up to 200 characters).' }
  if (!GOALS[goal]) return { error: 'Goal must be "blogger" or "business".' }
  if (typeof language !== 'string' || !language.trim() || language.length > 40) return { error: 'Please choose a content language.' }
  if (platform != null && platform !== '' && platform !== ANY_PLATFORM && !TARGET_PLATFORMS.includes(platform)) return { error: 'Please choose a target platform.' }
  return {
    input: {
      niche: niche.trim(),
      goal,
      language: language.trim(),
      platform: TARGET_PLATFORMS.includes(platform) ? platform : ANY_PLATFORM,
      brandProfile: brandProfile && typeof brandProfile === 'object' ? brandProfile : null,
      brandInputs: {
        examplePosts: Array.isArray(brandInputs?.examplePosts) ? brandInputs.examplePosts.slice(0, 5).map(String) : [],
        answers: brandInputs?.answers && typeof brandInputs.answers === 'object' ? brandInputs.answers : {},
      },
    },
  }
}

// Streams progress as newline-delimited JSON so the dashboard can show each agent live.
async function streamJob(res, run) {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.flushHeaders()
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  const emit = (event) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + '\n')
  }
  try {
    emit({ type: 'result', result: await run(emit, controller.signal) })
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error(err)
      emit({ type: 'error', message: friendlyError(err) })
    }
  } finally {
    res.end()
  }
}

// One Create Content run = 1 free generation (counted only when it finishes).
app.post('/api/generate', requireUser, async (req, res) => {
  const { input, error } = readContentRequest(req.body)
  if (error) return res.status(400).json({ error })
  let slot
  try {
    slot = await reserve(req.user, 1)
  } catch (err) {
    if (err instanceof LimitError) return limitResponse(res, err)
    throw err
  }
  try {
    await streamJob(res, async (emit, signal) => {
      const result = await runDirector(input, emit, { signal })
      await slot.commit(1)
      emit({ type: 'usage', usage: await getUsage(req.user) })
      return result
    })
  } finally {
    slot.release()
  }
})

// Content Plan: "Improve it" proposes changes; "generate" produces every day.
// "Improve it" doesn't use a generation, but needs at least one left (it still costs API calls).
app.post('/api/plan/improve', requireUser, async (req, res) => {
  const { input, error } = readContentRequest(req.body)
  if (error) return res.status(400).json({ error })
  const usage = await getUsage(req.user)
  if (!usage.unlimited && usage.remaining < 1) {
    return limitResponse(res, new LimitError('You’ve used your free generations. Join early access to keep planning and creating.', usage))
  }
  let plan
  try {
    plan = cleanPlan(req.body.plan)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
  await streamJob(res, (emit, signal) => runPlanImprove({ ...input, plan }, emit, { signal }))
})

// Each produced plan day = 1 free generation (failed days are not counted).
app.post('/api/plan/generate', requireUser, async (req, res) => {
  const { input, error } = readContentRequest(req.body)
  if (error) return res.status(400).json({ error })
  let plan
  try {
    plan = cleanPlan(req.body.plan)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
  let slot
  try {
    slot = await reserve(req.user, plan.days.length)
  } catch (err) {
    if (err instanceof LimitError) return limitResponse(res, err)
    throw err
  }
  try {
    await streamJob(res, async (emit, signal) => {
      const result = await runPlanGenerate({ ...input, plan }, emit, { signal, onDayDone: () => slot.commit(1) })
      emit({ type: 'usage', usage: await getUsage(req.user) })
      return result
    })
  } finally {
    slot.release()
  }
})

// ---------- Market Intel admin API (founder only) ----------
// Protected by ADMIN_TOKEN from .env. The browser sends it in the x-admin-token header.
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN || ''
  if (!expected) return res.status(503).json({ error: 'Set ADMIN_TOKEN in the .env file to use the Market Intel admin tab.' })
  const given = String(req.get('x-admin-token') || '')
  const ok = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  if (!ok) return res.status(401).json({ error: 'Wrong admin token.' })
  next()
}

const validNiche = (n) => typeof n === 'string' && n.trim() && n.length <= 200

app.get('/api/admin/market-intel', requireAdmin, async (_req, res) => {
  res.json(await overview())
})

// A niche + platform + language combination from the admin page.
function readCombo(src = {}) {
  if (!validNiche(src.niche)) return null
  if (src.language != null && (typeof src.language !== 'string' || src.language.length > 40)) return null
  return comboOf({ niche: src.niche, platform: src.platform, language: src.language })
}

app.get('/api/admin/briefs', requireAdmin, async (req, res) => {
  const combo = readCombo(req.query)
  if (!combo) return res.status(400).json({ error: 'niche is required' })
  res.json(await listBriefs(combo))
})

app.post('/api/admin/niches', requireAdmin, async (req, res) => {
  const combo = readCombo(req.body)
  if (!combo) return res.status(400).json({ error: 'Enter a niche (up to 200 characters).' })
  await trackCombo(combo)
  res.json({ ok: true })
})

// "Refresh now": research takes a minute or two, so start it and let the page poll the overview.
app.post('/api/admin/briefs/run', requireAdmin, (req, res) => {
  const combo = readCombo(req.body)
  if (!combo) return res.status(400).json({ error: 'Enter a niche (up to 200 characters).' })
  trackCombo(combo)
    .then(() => runBrief(combo, { trigger: 'manual' }))
    .catch((err) => console.error('Manual brief failed:', friendlyError(err)))
  res.status(202).json({ started: true })
})

app.post('/api/admin/founder-report/run', requireAdmin, (_req, res) => {
  runFounderReport({ trigger: 'manual' }).catch((err) => console.error('Manual founder report failed:', friendlyError(err)))
  res.status(202).json({ started: true })
})

// ---------- Feedback ("Suggest an idea / Report a problem", landing contact form) ----------
// Spam protection: per-IP rate limit, a hidden "website" field bots fill in, and strict length limits.
const feedbackLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: 'Too many messages from your network. Please try again in a few minutes.' })

app.post('/api/feedback', feedbackLimiter, async (req, res) => {
  if (req.body?.website) return res.status(201).json({ ok: true }) // honeypot: pretend success, store nothing
  const { value, error } = validateFeedback(req.body)
  if (error) return res.status(400).json({ error })
  await createFeedback(value)
  res.status(201).json({ ok: true })
})

app.get('/api/admin/feedback', requireAdmin, async (_req, res) => {
  res.json(await listFeedback())
})

app.patch('/api/admin/feedback/:id', requireAdmin, async (req, res) => {
  const updated = await setFeedbackDone(String(req.params.id), Boolean(req.body?.done))
  if (!updated) return res.status(404).json({ error: 'Not found.' })
  res.json(updated)
})

// In production (npm start) the server also serves the built React app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(dist))
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  console.log(`Viply API running on http://localhost:${port}`)
  if (MOCK) console.log('MOCK_AI=true — agents return sample answers, no API key used.')
  else if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠ ANTHROPIC_API_KEY is not set. Add it to the .env file.')
  startScheduler()
})
