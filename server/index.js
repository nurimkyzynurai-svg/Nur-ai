import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GOALS, LANGUAGES } from '../src/agents/index.js'
import { runDirector } from './director.js'
import crypto from 'node:crypto'
import { friendlyError, MOCK } from './claude.js'
import { listBriefs, overview, runBrief, runFounderReport, startScheduler, trackNiche } from './marketIntel.js'

const app = express()
app.use(express.json({ limit: '200kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mock: MOCK, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) })
})

// Streams progress as newline-delimited JSON so the dashboard can show each agent live.
app.post('/api/generate', async (req, res) => {
  const { niche, goal, language, brandProfile, brandInputs } = req.body || {}
  if (typeof niche !== 'string' || !niche.trim() || niche.length > 200) {
    return res.status(400).json({ error: 'Please enter your niche (up to 200 characters).' })
  }
  if (!GOALS[goal]) return res.status(400).json({ error: 'Goal must be "blogger" or "business".' })
  if (typeof language !== 'string' || !language.trim() || language.length > 40) {
    return res.status(400).json({ error: 'Please choose a content language.' })
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.flushHeaders()

  const controller = new AbortController()
  res.on('close', () => controller.abort())
  const emit = (event) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + '\n')
  }

  try {
    const result = await runDirector(
      {
        niche: niche.trim(),
        goal,
        language: language.trim(),
        brandProfile: brandProfile && typeof brandProfile === 'object' ? brandProfile : null,
        brandInputs: {
          examplePosts: Array.isArray(brandInputs?.examplePosts) ? brandInputs.examplePosts.slice(0, 5).map(String) : [],
          answers: brandInputs?.answers && typeof brandInputs.answers === 'object' ? brandInputs.answers : {},
        },
      },
      emit,
      { signal: controller.signal },
    )
    emit({ type: 'result', result })
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error(err)
      emit({ type: 'error', message: friendlyError(err) })
    }
  } finally {
    res.end()
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

app.get('/api/admin/briefs', requireAdmin, async (req, res) => {
  if (!validNiche(req.query.niche)) return res.status(400).json({ error: 'niche is required' })
  res.json(await listBriefs(req.query.niche))
})

app.post('/api/admin/niches', requireAdmin, async (req, res) => {
  if (!validNiche(req.body?.niche)) return res.status(400).json({ error: 'Enter a niche (up to 200 characters).' })
  await trackNiche(req.body.niche)
  res.json({ ok: true })
})

// Research runs take a minute or two: start them and let the page poll the overview.
app.post('/api/admin/briefs/run', requireAdmin, (req, res) => {
  if (!validNiche(req.body?.niche)) return res.status(400).json({ error: 'Enter a niche (up to 200 characters).' })
  trackNiche(req.body.niche)
    .then(() => runBrief(req.body.niche, { trigger: 'manual' }))
    .catch((err) => console.error('Manual brief failed:', friendlyError(err)))
  res.status(202).json({ started: true })
})

app.post('/api/admin/founder-report/run', requireAdmin, (_req, res) => {
  runFounderReport({ trigger: 'manual' }).catch((err) => console.error('Manual founder report failed:', friendlyError(err)))
  res.status(202).json({ started: true })
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
