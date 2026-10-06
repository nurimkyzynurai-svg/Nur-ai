import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardHeader from '../components/DashboardHeader.jsx'
import { Card, CopyButton, inputClass } from '../components/ui.jsx'
import { EMPTY_BRAND, ProfileSummary, VoiceSetup } from '../components/VoiceSetup.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ANY_PLATFORM, GOALS, LANGUAGES, TARGET_PLATFORMS } from '../agents/shared.js'
import MarketFitBlock from '../components/MarketFit.jsx'
import VoiceInput from '../components/VoiceInput.jsx'
import { LimitReached, UsagePill } from '../components/EarlyAccess.jsx'
import { estimateImproveCost, estimatePlanDayCost } from '../agents/costs.js'
import { brandKey, load, plansKey, removeCalendarPosts, save, upsertCalendarPosts } from '../lib/storage.js'
import { postStream } from '../lib/stream.js'

const MAX_DAYS = 31
const CAMPAIGN_GOALS = ['Product launch', 'Event', 'Sale or promotion', 'Brand awareness', 'Personal brand growth', 'Lead generation']
const PLATFORMS = ['', 'Instagram', 'TikTok', 'YouTube', 'Threads', 'LinkedIn', 'X', 'Facebook', 'Telegram']
const FORMATS = ['Reel', 'Short video', 'Carousel', 'Story', 'Post', 'Live', 'Thread', 'Article']
const CHANGE_STYLE = {
  kept: 'bg-slate-100 text-slate-600',
  improved: 'bg-indigo-100 text-indigo-700',
  new: 'bg-emerald-100 text-emerald-700',
  moved: 'bg-amber-100 text-amber-800',
}

const pad = (n) => String(n).padStart(2, '0')
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const addDays = (date, n) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
const prettyDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const uid = () => Math.random().toString(36).slice(2, 10)
const usd = (n) => `$${n.toFixed(2)}`

function newPlan() {
  const start = todayKey()
  return {
    id: uid(),
    name: '',
    campaignGoal: '',
    startDate: start,
    keyDate: addDays(start, 7),
    keyDateLabel: '',
    vision: '',
    notes: '',
    days: [{ id: uid(), date: start, content: '', platform: '', format: '', locked: false }],
    mode: 'execute',
    proposal: null,
    approvedDays: null,
    results: {},
    errors: {},
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Parses a pasted plan. One item per line. A line may start with a date (2026-03-01, 01.03, 01.03.2026, 1/3)
 * or "Day 3" / "День 3"; lines without a date go on the next day.
 */
export function parsePastedPlan(textValue, startDate) {
  const year = startDate.slice(0, 4)
  const out = []
  let last = null
  for (const raw of textValue.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    let date = null
    let content = line
    let m
    if ((m = line.match(/^(\d{4}-\d{2}-\d{2})\s*[:\-–—.)]?\s*(.*)$/))) [, date, content] = m
    else if ((m = line.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*[:\-–—)]?\s*(.*)$/))) {
      const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : year
      date = `${y}-${pad(m[2])}-${pad(m[1])}`
      content = m[4]
    } else if ((m = line.match(/^(?:day|день|күн)\s*(\d+)\s*[:\-–—.)]?\s*(.*)$/i))) {
      date = addDays(startDate, Number(m[1]) - 1)
      content = m[2]
    }
    if (!date || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) date = last ? addDays(last, 1) : startDate
    if (!content.trim()) continue
    const existing = out.find((d) => d.date === date)
    if (existing) existing.content += `\n${content.trim()}`
    else out.push({ id: uid(), date, content: content.trim(), platform: '', format: '', locked: false })
    last = date
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

function DayEditor({ day, onChange, onRemove, language }) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[150px_1fr]">
      <div className="space-y-2">
        <input type="date" value={day.date} onChange={(e) => onChange({ date: e.target.value })} className={inputClass} aria-label="Date" />
        <select value={day.platform} onChange={(e) => onChange({ platform: e.target.value })} className={inputClass} aria-label="Platform">
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p || 'Any platform'}
            </option>
          ))}
        </select>
        <input list="plan-formats" value={day.format} onChange={(e) => onChange({ format: e.target.value })} placeholder="Format (any)" className={inputClass} aria-label="Format" />
      </div>
      <div className="flex flex-col gap-2">
        <textarea
          rows={4}
          value={day.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="What goes out this day — the idea, message, offer, call to action, any details. Write it any way you like."
          className={`${inputClass} flex-1`}
          aria-label="Content"
        />
        <VoiceInput value={day.content} onChange={(v) => onChange({ content: v })} language={language} maxLength={2000} className="-mt-1" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-600" title="Improve it mode will not change this day">
            <input type="checkbox" checked={day.locked} onChange={(e) => onChange({ locked: e.target.checked })} />
            Keep exactly as written
          </label>
          <button type="button" onClick={onRemove} className="text-xs text-slate-400 hover:text-red-600">
            Remove day
          </button>
        </div>
      </div>
    </div>
  )
}

function Proposal({ plan, update, original, language }) {
  const proposal = plan.proposal
  const setDay = (date, patch) => update({ proposal: { ...proposal, days: proposal.days.map((d) => (d.date === date ? { ...d, ...patch } : d)) } })
  const revert = (d) => {
    if (d.change === 'new') update({ proposal: { ...proposal, days: proposal.days.filter((x) => x.date !== d.date) } })
    else if (d.change === 'moved') {
      const o = original.find((x) => x.date === d.originalDate)
      const days = proposal.days.filter((x) => x.date !== d.date)
      if (o && !days.some((x) => x.date === o.date)) days.push({ ...o, change: 'kept', reason: 'Restored by you.', phase: d.phase })
      update({ proposal: { ...proposal, days: days.sort((a, b) => a.date.localeCompare(b.date)) } })
    } else setDay(d.date, { content: d.originalContent, change: 'kept', reason: 'Reverted to your version.' })
  }
  const restore = (r) =>
    update({
      proposal: {
        ...proposal,
        removed: proposal.removed.filter((x) => x.date !== r.date),
        days: [...proposal.days, { date: r.date, content: r.content, format: '', platform: '', phase: '', change: 'kept', reason: 'Restored by you.' }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      },
    })
  const counts = proposal.days.reduce((acc, d) => ({ ...acc, [d.change]: (acc[d.change] || 0) + 1 }), {})

  return (
    <Card title="Creative Director’s proposal — review before generating">
      <p className="text-sm text-slate-700">{proposal.strategySummary}</p>
      {proposal.phases?.length > 0 && (
        <ol className="mt-4 flex flex-wrap gap-2">
          {proposal.phases.map((ph, i) => (
            <li key={i} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              <span className="font-semibold capitalize">{ph.name}</span> · {ph.start_date.slice(5)}–{ph.end_date.slice(5)}
              <span className="block text-indigo-700/80">{ph.purpose}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-slate-500">
        {['kept', 'improved', 'new', 'moved']
          .filter((k) => counts[k])
          .map((k) => `${counts[k]} ${k}`)
          .join(' · ')}
        {proposal.removed.length ? ` · ${proposal.removed.length} removed` : ''} — edit anything below, or revert a change.
      </p>
      {proposal.notes?.length > 0 && <p className="mt-2 text-xs text-amber-700">{proposal.notes.join(' ')}</p>}

      <ul className="mt-4 space-y-3">
        {proposal.days.map((d) => (
          <li key={d.date} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{prettyDate(d.date)}</span>
              {d.date === plan.keyDate && <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Key date</span>}
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${CHANGE_STYLE[d.change]}`}>{d.change}</span>
              {d.locked && <span className="text-[11px] text-slate-400">🔒 locked</span>}
              {d.phase && <span className="text-[11px] capitalize text-slate-500">{d.phase}</span>}
              {(d.format || d.platform) && <span className="text-[11px] text-slate-400">{[d.format, d.platform].filter(Boolean).join(' · ')}</span>}
              {d.change !== 'kept' && (
                <button type="button" onClick={() => revert(d)} className="ml-auto text-xs text-slate-500 hover:text-red-600">
                  {d.change === 'new' ? 'Remove' : 'Revert to mine'}
                </button>
              )}
            </div>
            {d.originalContent && <p className="mt-2 text-xs text-slate-400 line-through">{d.originalContent}</p>}
            {d.change === 'moved' && <p className="mt-1 text-xs text-amber-700">Moved from {prettyDate(d.originalDate)}</p>}
            <textarea
              rows={3}
              value={d.content}
              disabled={d.locked}
              onChange={(e) => setDay(d.date, { content: e.target.value })}
              className={`${inputClass} mt-2 disabled:bg-slate-50 disabled:text-slate-500`}
            />
            {!d.locked && <VoiceInput value={d.content} onChange={(v) => setDay(d.date, { content: v })} language={language} maxLength={2000} />}
            {d.reason && <p className="mt-1 text-xs text-slate-500">Why: {d.reason}</p>}
          </li>
        ))}
      </ul>

      {proposal.removed.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-900">Removed from your plan</p>
          <ul className="mt-2 space-y-2">
            {proposal.removed.map((r) => (
              <li key={r.date} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span>
                  <span className="font-medium">{prettyDate(r.date)}:</span> <span className="text-slate-500 line-through">{r.content}</span>
                  <span className="block text-xs text-slate-500">Why: {r.reason}</span>
                </span>
                <button type="button" onClick={() => restore(r)} className="text-xs font-medium text-indigo-600">
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function DayResult({ date, piece, error, onRegenerate, busy }) {
  const [open, setOpen] = useState(false)
  if (error)
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
        <span>
          <span className="font-medium">{prettyDate(date)}</span> — <span className="text-red-700">{error}</span>
        </span>
        <button disabled={busy} onClick={onRegenerate} className="text-xs font-medium text-indigo-600 disabled:opacity-50">
          Try again
        </button>
      </li>
    )
  const caption = piece.captions[0]
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="flex-none text-sm font-semibold text-slate-900">{prettyDate(date)}</span>
          <span className="truncate text-sm text-slate-600">{piece.script.title}</span>
        </button>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${piece.needsReview ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {piece.needsReview ? `Needs review · ${piece.quality.overall_score}/10` : `${piece.quality.overall_score}/10`}
        </span>
        {piece.marketFit?.available && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${piece.marketFit.marketRisk ? 'bg-amber-100 text-amber-800' : 'bg-ink-soft text-ink'}`}>
            {piece.marketFit.marketRisk ? `Market risk · ${piece.marketFit.score}/10` : `Market fit ${piece.marketFit.score}/10`}
          </span>
        )}
        <button onClick={() => setOpen(!open)} className="text-xs font-medium text-indigo-600">
          {open ? 'Hide' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-4 text-sm">
          {'marketFit' in piece && <MarketFitBlock fit={piece.marketFit} brief={piece.marketBrief} compact />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hooks</p>
            <ol className="mt-1 space-y-1">
              {piece.hooks.map((h, i) => (
                <li key={i} className={i === piece.bestHookIndex ? 'font-semibold text-indigo-700' : 'text-slate-700'}>
                  {i === piece.bestHookIndex ? '★ ' : ''}
                  {h.text}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Script · ~{Math.round(piece.script.duration_seconds)}s</p>
              <CopyButton text={piece.script.full_voiceover} />
            </div>
            <ol className="mt-1 space-y-2">
              {piece.script.beats.map((b, i) => (
                <li key={i} className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[11px] font-semibold uppercase text-indigo-600">
                    {b.section} · {b.time}
                  </span>
                  <p className="text-slate-800">{b.voiceover}</p>
                  <p className="text-xs text-slate-500">
                    📝 {b.on_screen_text} · 🎥 {b.visual}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Captions</p>
            <ul className="mt-1 space-y-2">
              {piece.captions.map((c) => (
                <li key={c.platform} className="rounded-lg bg-slate-50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">{c.platform}</span>
                    <CopyButton text={`${c.caption}\n\n${c.hashtags.join(' ')}`} />
                  </div>
                  <p className="whitespace-pre-line text-slate-800">{c.caption}</p>
                  <p className="text-xs text-indigo-600">{c.hashtags.join(' ')}</p>
                </li>
              ))}
            </ul>
          </div>
          {piece.needsReview && piece.quality.feedback?.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">What to fix before posting</p>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                {piece.quality.feedback.map((f) => (
                  <li key={f.id}>
                    {f.problem} → {f.fix}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{caption ? `Call to action: ${caption.cta}` : ''}</span>
            <button disabled={busy} onClick={onRegenerate} className="font-medium text-indigo-600 disabled:opacity-50">
              Regenerate this day
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function ContentPlan() {
  const { user, usage, setUsage } = useAuth()
  const [limitMessage, setLimitMessage] = useState('')
  const [store, setStore] = useState(() => {
    const s = load(plansKey(user.email), null)
    if (s?.plans?.length) return s
    const p = newPlan()
    return { plans: [p], activeId: p.id }
  })
  const plan = store.plans.find((p) => p.id === store.activeId) || store.plans[0]
  const brandSaved = load(brandKey(user.email), null)
  const [niche, setNiche] = useState(brandSaved?.niche || load(`viply_dashboard_${user.email}`, {}).niche || '')
  const [goal, setGoal] = useState(brandSaved?.goal || 'business')
  const [language, setLanguage] = useState(brandSaved?.language && LANGUAGES.includes(brandSaved.language) ? brandSaved.language : 'English')
  const [customLanguage, setCustomLanguage] = useState('')
  const [platform, setPlatform] = useState(brandSaved?.planPlatform || ANY_PLATFORM)
  const [brand, setBrand] = useState(brandSaved?.inputs || EMPTY_BRAND)
  const [profile, setProfile] = useState(brandSaved?.profile || null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [running, setRunning] = useState(null) // 'improve' | 'generate'
  const [progress, setProgress] = useState({}) // date → { status, detail }
  const [steps, setSteps] = useState([])
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  useEffect(() => save(plansKey(user.email), store), [store, user.email])
  useEffect(() => {
    const prev = load(brandKey(user.email), {})
    save(brandKey(user.email), { ...prev, niche, goal, planPlatform: platform, inputs: brand, profile })
  }, [user.email, niche, goal, platform, brand, profile])
  useEffect(() => () => abortRef.current?.abort(), [])

  const update = (patch) =>
    setStore((s) => ({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)) }))
  const setDay = (id, patch) => update({ days: plan.days.map((d) => (d.id === id ? { ...d, ...patch } : d)), proposal: null, approvedDays: null })
  const lang = language === 'Other' ? customLanguage.trim() : language

  const finalDays = useMemo(() => {
    if (plan.mode === 'improve') return plan.approvedDays
    return plan.days.filter((d) => d.content.trim())
  }, [plan])
  const dayCost = estimatePlanDayCost()

  function validate() {
    if (!plan.name.trim()) return 'Give the campaign a name.'
    if (!plan.campaignGoal.trim()) return 'Describe the campaign goal.'
    if (!plan.startDate || !plan.keyDate) return 'Set the start date and the key date.'
    if (plan.keyDate < plan.startDate) return 'The key date must be on or after the start date.'
    const filled = plan.days.filter((d) => d.content.trim())
    if (!filled.length) return 'Add at least one day with content.'
    if (filled.length > MAX_DAYS) return `A plan can have at most ${MAX_DAYS} days.`
    const dates = filled.map((d) => d.date)
    if (dates.some((d) => !d)) return 'Every day needs a date.'
    if (new Set(dates).size !== dates.length) return 'Two items share a date. Keep one item per day.'
    if (!niche.trim()) return 'Enter your niche or industry.'
    if (!lang) return 'Choose the content language.'
    if (!profile && !brand.examplePosts.some((p) => p.trim()) && !Object.values(brand.answers).some((a) => a.trim()))
      return 'Fill in Voice Setup (at least one post or answer) so the agents can learn your style.'
    return ''
  }

  const requestBody = (days) => ({
    niche,
    goal,
    language: lang,
    platform,
    brandProfile: profile,
    brandInputs: profile ? undefined : brand,
    plan: { name: plan.name, campaignGoal: plan.campaignGoal, startDate: plan.startDate, keyDate: plan.keyDate, keyDateLabel: plan.keyDateLabel, vision: plan.vision, notes: plan.notes, days },
  })

  function onStep(evt) {
    if (evt.type === 'brandProfile') setProfile(evt.profile)
    if (evt.type === 'step') setSteps((prev) => [...prev.filter((s) => s.agent !== evt.agent), evt])
  }

  async function improve() {
    const problem = validate()
    if (problem) return setError(problem)
    const days = plan.days.filter((d) => d.content.trim())
    if (!window.confirm(`The Creative Director will improve your ${days.length}-day plan.\n\nEstimated cost: about ${usd(estimateImproveCost(days.length))} (plus up to $0.30 if today’s Market Brief is not cached yet). Continue?`)) return
    setError('')
    setSteps([])
    setRunning('improve')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      let result
      await postStream('/api/plan/improve', requestBody(days), {
        signal: controller.signal,
        onEvent: (evt) => {
          onStep(evt)
          if (evt.type === 'result') result = evt.result
          if (evt.type === 'error') throw new Error(evt.message)
          if (evt.type === 'usage') setUsage(evt.usage)
        },
      })
      if (result) update({ proposal: { strategySummary: result.strategySummary, phases: result.phases, days: result.days, removed: result.removed, notes: result.notes }, approvedDays: null })
    } catch (err) {
      if (err.code === 'FREE_LIMIT_REACHED') {
        setLimitMessage(err.message)
        if (err.usage) setUsage(err.usage)
      } else if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setRunning(null)
    }
  }

  function approve() {
    const days = plan.proposal.days.filter((d) => d.content.trim()).map((d) => ({ date: d.date, content: d.content, platform: d.platform, format: d.format, phase: d.phase, locked: Boolean(d.locked) }))
    update({ approvedDays: days })
  }

  function toCalendarPost(day, piece) {
    return {
      id: `plan-${plan.id}-${day.date}`,
      planId: plan.id,
      date: day.date,
      time: '12:00',
      platform: day.platform || 'Instagram',
      format: day.format || 'Post',
      title: piece.script.title,
      source: 'plan',
      campaign: plan.name,
      hook: piece.hook?.text || piece.hooks[piece.bestHookIndex]?.text || '',
      voiceover: piece.script.full_voiceover,
      caption: piece.captions[0] ? `${piece.captions[0].caption}\n\n${piece.captions[0].hashtags.join(' ')}` : '',
      score: piece.quality.overall_score,
      needsReview: piece.needsReview,
      marketFitScore: piece.marketFit?.available ? piece.marketFit.score : null,
      marketRisk: Boolean(piece.marketFit?.marketRisk),
    }
  }

  async function generate(onlyDates) {
    const problem = validate()
    if (problem) return setError(problem)
    const all = finalDays || []
    const days = onlyDates ? all.filter((d) => onlyDates.includes(d.date)) : all
    if (!days.length) return setError(plan.mode === 'improve' ? 'Approve the proposal first.' : 'Add at least one day with content.')
    if (!window.confirm(`Generate ${days.length} day(s): hooks, script with quality review, and captions for each.${usage && !usage.unlimited ? `\nThis uses ${days.length} of your ${usage.remaining} free generations.` : ''}\n\nEstimated cost: about ${usd(dayCost.typical * days.length)}, at most ${usd(dayCost.max * days.length)}. Continue?`)) return
    setError('')
    setSteps([])
    setProgress(Object.fromEntries(days.map((d) => [d.date, { status: 'queued', detail: 'Waiting…' }])))
    setRunning('generate')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await postStream('/api/plan/generate', requestBody(days), {
        signal: controller.signal,
        onEvent: (evt) => {
          onStep(evt)
          if (evt.type === 'error') throw new Error(evt.message)
          if (evt.type === 'usage') setUsage(evt.usage)
          if (evt.type !== 'day') return
          setProgress((p) => ({ ...p, [evt.date]: { status: evt.status, detail: evt.detail } }))
          if (evt.status === 'done') {
            const day = days.find((d) => d.date === evt.date)
            setStore((s) => ({
              ...s,
              plans: s.plans.map((p) =>
                p.id === plan.id ? { ...p, results: { ...p.results, [evt.date]: evt.result }, errors: { ...p.errors, [evt.date]: undefined } } : p,
              ),
            }))
            upsertCalendarPosts(user.email, [toCalendarPost(day, evt.result)])
          }
          if (evt.status === 'error') {
            setStore((s) => ({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? { ...p, errors: { ...p.errors, [evt.date]: evt.detail } } : p)) }))
          }
        },
      })
    } catch (err) {
      if (err.code === 'FREE_LIMIT_REACHED') {
        setLimitMessage(err.message)
        if (err.usage) setUsage(err.usage)
      } else if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setRunning(null)
    }
  }

  function addDay() {
    const last = plan.days[plan.days.length - 1]
    update({ days: [...plan.days, { id: uid(), date: last?.date ? addDays(last.date, 1) : plan.startDate, content: '', platform: '', format: '', locked: false }] })
  }

  function fillDays() {
    const have = new Set(plan.days.map((d) => d.date))
    const extra = []
    for (let d = plan.startDate; d <= plan.keyDate && have.size + extra.length < MAX_DAYS; d = addDays(d, 1)) {
      if (!have.has(d)) extra.push({ id: uid(), date: d, content: '', platform: '', format: '', locked: false })
    }
    update({ days: [...plan.days, ...extra].sort((a, b) => a.date.localeCompare(b.date)) })
  }

  function applyPaste() {
    const parsed = parsePastedPlan(pasteText, plan.startDate)
    if (!parsed.length) return setError('Nothing to import — write one day per line.')
    update({ days: parsed.slice(0, MAX_DAYS), proposal: null, approvedDays: null })
    setPasteText('')
    setPasteOpen(false)
    setError(parsed.length > MAX_DAYS ? `Only the first ${MAX_DAYS} days were imported.` : '')
  }

  function createPlan() {
    const p = newPlan()
    setStore((s) => ({ plans: [...s.plans, p], activeId: p.id }))
    setProgress({})
  }

  function deletePlan() {
    if (!window.confirm(`Delete “${plan.name || 'Untitled plan'}” and remove its days from your calendar?`)) return
    removeCalendarPosts(user.email, (p) => p.planId === plan.id)
    setStore((s) => {
      const rest = s.plans.filter((p) => p.id !== plan.id)
      const plans = rest.length ? rest : [newPlan()]
      return { plans, activeId: plans[0].id }
    })
    setProgress({})
  }

  const resultDates = Object.keys(plan.results || {}).filter((d) => plan.results[d])
  const errorDates = Object.keys(plan.errors || {}).filter((d) => plan.errors[d])
  const shownDates = [...new Set([...resultDates, ...errorDates])].sort()
  const busy = Boolean(running)

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader />
      <datalist id="plan-formats">
        {FORMATS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Content Plan</h1>
            <p className="mt-1 text-slate-600">Bring your own plan. We execute it exactly — or improve it first, with your approval.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={plan.id}
              onChange={(e) => {
                setStore((s) => ({ ...s, activeId: e.target.value }))
                setProgress({})
              }}
              className="max-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              aria-label="Choose plan"
            >
              {store.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || 'Untitled plan'}
                </option>
              ))}
            </select>
            <button onClick={createPlan} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 disabled:opacity-50">
              + New plan
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card title="1. Campaign">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Campaign name</span>
                  <input value={plan.name} onChange={(e) => update({ name: e.target.value })} maxLength={120} className={`mt-1 ${inputClass}`} />
                </label>
                <div className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Campaign goal</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {CAMPAIGN_GOALS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => update({ campaignGoal: g })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${plan.campaignGoal === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <input
                    value={plan.campaignGoal}
                    onChange={(e) => update({ campaignGoal: e.target.value })}
                    maxLength={300}
                    placeholder="Or describe any goal in your own words"
                    className={`mt-2 ${inputClass}`}
                  />
                  <VoiceInput value={plan.campaignGoal} onChange={(v) => update({ campaignGoal: v })} language={lang} maxLength={300} />
                </div>
                <label>
                  <span className="text-sm font-medium text-slate-700">Start date</span>
                  <input type="date" value={plan.startDate} onChange={(e) => update({ startDate: e.target.value })} className={`mt-1 ${inputClass}`} />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">Key date</span>
                  <input type="date" value={plan.keyDate} onChange={(e) => update({ keyDate: e.target.value })} className={`mt-1 ${inputClass}`} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">What happens on the key date?</span>
                  <input
                    value={plan.keyDateLabel}
                    onChange={(e) => update({ keyDateLabel: e.target.value })}
                    maxLength={120}
                    placeholder="Launch, sale starts, event, opening, release…"
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Your vision</span>
                    <textarea
                      rows={3}
                      value={plan.vision}
                      onChange={(e) => update({ vision: e.target.value })}
                      maxLength={4000}
                      placeholder="The feeling, look and message you want. What must people think, feel and do?"
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <VoiceInput value={plan.vision} onChange={(v) => update({ vision: v })} language={lang} maxLength={4000} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Notes</span>
                    <textarea
                      rows={2}
                      value={plan.notes}
                      onChange={(e) => update({ notes: e.target.value })}
                      maxLength={4000}
                      placeholder="Facts the agents must use: offer details, prices, names, links, what to avoid…"
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <VoiceInput value={plan.notes} onChange={(v) => update({ notes: v })} language={lang} maxLength={4000} />
                </div>
              </div>
            </Card>

            <Card
              title={`2. Days (${plan.days.filter((d) => d.content.trim()).length})`}
              action={
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPasteOpen(!pasteOpen)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300">
                    Paste a plan
                  </button>
                  <button type="button" onClick={fillDays} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300">
                    Add every day to key date
                  </button>
                </div>
              }
            >
              {pasteOpen && (
                <div className="mb-4 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">
                    One day per line. Start a line with a date (2026-03-01, 01.03, 1/3) or “Day 3” — lines without a date go on the next day. This replaces the days below.
                  </p>
                  <VoiceInput value={pasteText} onChange={setPasteText} language={lang} className="-mb-1" />
                  <textarea rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className={`mt-2 ${inputClass}`} placeholder={'Day 1: …\nDay 2: …\nDay 3: …'} />
                  <button type="button" onClick={applyPaste} className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
                    Import days
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {plan.days.map((d) => (
                  <DayEditor key={d.id} day={d} language={lang} onChange={(patch) => setDay(d.id, patch)} onRemove={() => update({ days: plan.days.filter((x) => x.id !== d.id), proposal: null, approvedDays: null })} />
                ))}
              </div>
              <button type="button" onClick={addDay} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                + Add day
              </button>
            </Card>

            <Card title="3. Brand & audience">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Niche or industry</span>
                  <input value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={200} placeholder="Who you serve and what you offer" className={`mt-1 ${inputClass}`} />
                </label>
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">Optimize for</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {Object.entries(GOALS).map(([id, g]) => (
                      <label key={id} className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-xs ${goal === id ? 'border-indigo-600 bg-indigo-50 font-semibold' : 'border-slate-300'}`}>
                        <input type="radio" name="plan-goal" className="sr-only" checked={goal === id} onChange={() => setGoal(id)} />
                        {g.metrics}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span className="text-sm font-medium text-slate-700">Default platform</span>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={`mt-1 ${inputClass}`}>
                    {[ANY_PLATFORM, ...TARGET_PLATFORMS].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-slate-400">Used for days that don’t name a platform, and for market research.</span>
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">Content language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`mt-1 ${inputClass}`}>
                    {[...LANGUAGES, 'Other'].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                  {language === 'Other' && (
                    <input value={customLanguage} onChange={(e) => setCustomLanguage(e.target.value)} maxLength={40} placeholder="Type your language" className={`mt-2 ${inputClass}`} />
                  )}
                </label>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                {profile ? (
                  <>
                    <p className="mb-3 text-sm text-slate-500">
                      Brand DNA — every agent follows it. Edit it in <Link to="/dashboard/create" className="font-medium text-indigo-600">Create Content</Link>.
                    </p>
                    <ProfileSummary profile={profile} />
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-slate-500">Voice Setup — the Brand DNA Agent learns your style from these. You only do this once.</p>
                    <VoiceSetup brand={brand} setBrand={setBrand} language={lang} />
                  </>
                )}
              </div>
            </Card>

            {plan.mode === 'improve' && plan.proposal && !plan.approvedDays && <Proposal plan={plan} update={update} original={plan.days} language={lang} />}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <Card title="4. How should we use your plan?">
              <div className="space-y-2">
                {[
                  ['execute', 'Execute as is', 'Your ideas stay exactly as written. Agents turn each day into a ready script, hooks and captions.'],
                  ['improve', 'Improve it', 'The Creative Director strengthens the campaign (warm-up, teasers, main moment, social proof, follow-up), shows every change and why, and waits for your approval.'],
                ].map(([id, label, desc]) => (
                  <label key={id} className={`block cursor-pointer rounded-xl border p-3 ${plan.mode === id ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20' : 'border-slate-300 hover:border-indigo-300'}`}>
                    <input type="radio" name="plan-mode" className="sr-only" checked={plan.mode === id} onChange={() => update({ mode: id })} />
                    <span className="block font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{desc}</span>
                  </label>
                ))}
              </div>

              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex justify-center">
                <UsagePill usage={usage} />
              </div>
              {(limitMessage || usage?.remaining === 0) && (
                <div className="mt-4">
                  <LimitReached message={limitMessage} />
                </div>
              )}

              <div className="mt-4 space-y-2">
                {plan.mode === 'improve' && !plan.proposal && (
                  <button onClick={improve} disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {running === 'improve' ? 'Creative Director is working…' : '💡 Improve my plan'}
                  </button>
                )}
                {plan.mode === 'improve' && plan.proposal && !plan.approvedDays && (
                  <>
                    <button onClick={approve} disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                      ✓ Approve proposal
                    </button>
                    <button onClick={() => update({ proposal: null })} disabled={busy} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-red-300 hover:text-red-600">
                      Discard proposal
                    </button>
                  </>
                )}
                {plan.mode === 'improve' && plan.approvedDays && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Proposal approved: {plan.approvedDays.length} days.{' '}
                    <button onClick={() => update({ approvedDays: null })} className="font-semibold underline">
                      Edit again
                    </button>
                  </p>
                )}
                {(plan.mode === 'execute' || plan.approvedDays) && (
                  <>
                    <button onClick={() => generate()} disabled={busy || !finalDays?.length} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                      {running === 'generate' ? 'Your AI team is working…' : `⚡ Generate ${finalDays?.length || 0} days`}
                    </button>
                    <p className="text-center text-xs text-slate-500">
                      About {usd(dayCost.typical * (finalDays?.length || 0))} · at most {usd(dayCost.max * (finalDays?.length || 0))}
                    </p>
                  </>
                )}
                {busy && (
                  <button onClick={() => abortRef.current?.abort()} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-red-300 hover:text-red-600">
                    Stop
                  </button>
                )}
              </div>
              <button onClick={deletePlan} disabled={busy} className="mt-4 text-xs text-slate-400 hover:text-red-600 disabled:opacity-50">
                Delete this plan
              </button>
            </Card>

            {(busy || Object.keys(progress).length > 0) && (
              <Card title="Progress">
                {steps.length > 0 && (
                  <ul className="mb-3 space-y-1 text-xs text-slate-500">
                    {steps.map((s) => (
                      <li key={s.agent}>
                        {s.status === 'running' ? '⏳' : '✓'} {s.name}: {s.detail}
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="space-y-1.5">
                  {Object.entries(progress)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, p]) => (
                      <li key={date} className="flex items-start gap-2 text-sm">
                        <span className="w-5 flex-none">
                          {p.status === 'done' ? '✅' : p.status === 'error' ? '⚠️' : p.status === 'running' && busy ? (
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                          ) : (
                            '·'
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-slate-800">{prettyDate(date)}</span>
                          <span className="block truncate text-xs text-slate-500">{p.status === 'running' && !busy ? 'Stopped' : p.detail}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
          </aside>
        </div>

        {shownDates.length > 0 && (
          <Card
            title={`Ready content (${resultDates.length})`}
            action={
              <div className="flex items-center gap-3">
                {errorDates.length > 0 && (
                  <button onClick={() => generate(errorDates)} disabled={busy} className="text-sm font-medium text-indigo-600 disabled:opacity-50">
                    Retry {errorDates.length} failed
                  </button>
                )}
                <Link to="/dashboard" className="text-sm font-medium text-indigo-600">
                  Open calendar →
                </Link>
              </div>
            }
          >
            <ul className="space-y-2">
              {shownDates.map((date) => (
                <DayResult key={date} date={date} piece={plan.results[date]} error={plan.results[date] ? null : plan.errors[date]} busy={busy} onRegenerate={() => generate([date])} />
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  )
}
