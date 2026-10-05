import { useEffect, useRef, useState } from 'react'
import DashboardHeader from '../components/DashboardHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { GOALS, LANGUAGES } from '../agents/shared.js'

const PIPELINE = [
  ['brandDna', 'Brand DNA Agent', '🧬'],
  ['trend', 'Trend Agent', '📡'],
  ['hook', 'Hook Agent', '🪝'],
  ['script', 'Script Agent', '📝'],
  ['quality', 'Quality Agent', '🔍'],
  ['caption', 'Caption Agent', '✍️'],
  ['director', 'Director Agent', '🎬'],
]
const ICONS = Object.fromEntries(PIPELINE.map(([id, , icon]) => [id, icon]))

const QUESTIONS = [
  ['tone', 'Tone', 'How should your content sound? (e.g. warm, bold, funny, calm)'],
  ['style', 'Style', 'How do you like to write and present? (short lines, stories, lists, emojis…)'],
  ['audience', 'Audience', 'Who are you talking to? What do they want?'],
  ['phrases', 'Favorite phrases', 'Words or expressions you use often'],
  ['neverDo', 'Never do', 'Topics, words or styles we must never use'],
]

const EMPTY_BRAND = { examplePosts: ['', '', ''], answers: { tone: '', style: '', audience: '', phrases: '', neverDo: '' } }

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function VoiceSetup({ brand, setBrand }) {
  const setPost = (i, v) => setBrand({ ...brand, examplePosts: brand.examplePosts.map((p, j) => (j === i ? v : p)) })
  const setAnswer = (k, v) => setBrand({ ...brand, answers: { ...brand.answers, [k]: v } })
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700">Your 3–5 best posts</p>
        <p className="text-xs text-slate-500">Paste the text or script of posts that performed well and sound like you.</p>
        <div className="mt-2 space-y-2">
          {brand.examplePosts.map((post, i) => (
            <textarea key={i} rows={3} value={post} onChange={(e) => setPost(i, e.target.value)} placeholder={`Post ${i + 1}`} className={input} />
          ))}
        </div>
        {brand.examplePosts.length < 5 && (
          <button type="button" onClick={() => setBrand({ ...brand, examplePosts: [...brand.examplePosts, ''] })} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            + Add another post
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {QUESTIONS.map(([key, label, hint], i) => (
          <label key={key} className={key === 'neverDo' ? 'sm:col-span-2' : ''}>
            <span className="text-sm font-medium text-slate-700">{i + 1}. {label}</span>
            <input value={brand.answers[key]} onChange={(e) => setAnswer(key, e.target.value)} placeholder={hint} className={`mt-1 ${input}`} />
          </label>
        ))}
      </div>
    </div>
  )
}

function ProfileSummary({ profile }) {
  const rows = [
    ['Tone', profile.tone],
    ['Style', profile.style],
    ['Audience', profile.audience],
    ['Favorite phrases', profile.favorite_phrases?.join(' · ')],
    ['Never do', profile.never_do?.join(' · ')],
  ]
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className={k === 'Never do' ? 'sm:col-span-2' : ''}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
          <dd className="mt-0.5 text-slate-700">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function Progress({ steps, running }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-indigo-50 text-base">{ICONS[s.agent]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">{s.name}</p>
            <p className="truncate text-xs text-slate-500">{s.detail}</p>
          </div>
          <span className="mt-1 flex-none text-xs font-semibold">
            {s.status === 'running' && running && (
              <span className="inline-flex items-center gap-1.5 text-indigo-600">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /> Working
              </span>
            )}
            {s.status === 'running' && !running && <span className="text-red-500">Stopped</span>}
            {s.status === 'done' && <span className="text-emerald-600">✓ Done</span>}
            {s.status === 'skipped' && <span className="text-slate-400">↷ Saved</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ScoreRing({ score, passScore }) {
  const color = score >= passScore ? 'text-emerald-600' : score >= passScore - 2 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className={`grid h-24 w-24 flex-none place-items-center rounded-full border-8 border-current ${color}`}>
      <span className="text-3xl font-extrabold">{score}</span>
    </div>
  )
}

function Results({ result }) {
  const [platform, setPlatform] = useState(0)
  const { quality, script, hooks, bestHookIndex, captions, plan, idea } = result
  const caption = captions[platform]

  return (
    <div className="space-y-6">
      {result.needsReview && (
        <div role="alert" className="flex gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
          <span className="text-2xl" aria-hidden="true">⚠️</span>
          <div>
            <p className="font-bold text-amber-900">Needs review before posting</p>
            <p className="mt-1 text-sm text-amber-800">
              After {quality.maxAttempts} drafts the best score was {quality.overall_score}/10 (the bar is {quality.passScore}). Below is the best draft (draft{' '}
              {quality.bestAttempt}). Fix the points in “What to fix” before you post it.
            </p>
          </div>
        </div>
      )}

      <Card
        title="Quality score"
        action={
          result.needsReview ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">Needs review</span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">Approved</span>
          )
        }
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={quality.overall_score} passScore={quality.passScore} />
          <div className="flex-1 space-y-2 text-sm">
            <p>
              <span className="font-semibold">Virality:</span> {quality.virality_score}/10 · <span className="font-semibold">Brand match:</span> {quality.brand_match_score}/10 ·{' '}
              <span className="text-slate-500">pass score {quality.passScore}</span>
            </p>
            <p className="text-slate-600">
              {quality.attempts.length === 1 && quality.passed
                ? 'Approved on the first draft.'
                : `Drafts: ${quality.attempts.map((a) => `${a.score}/10`).join(' → ')}`}
            </p>
            {quality.strengths?.length > 0 && <p className="text-emerald-700">✓ {quality.strengths.join(' · ')}</p>}
          </div>
        </div>
        {quality.feedback?.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-900">{result.needsReview ? 'What to fix' : 'Optional polish'}</p>
            <ul className="mt-2 space-y-2">
              {quality.feedback.map((f) => (
                <li key={f.id} className={`rounded-xl p-3 text-sm ${result.needsReview ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className="text-slate-800">
                    <span className="mr-2 font-mono text-xs text-slate-400">{f.id}</span>
                    {f.problem}
                  </p>
                  {f.quote && <p className="mt-1 text-xs italic text-slate-500">“{f.quote}”</p>}
                  <p className="mt-1 text-xs text-slate-600">→ {f.fix}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {plan && (
        <Card title="Director’s summary">
          {plan.warning && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{plan.warning}</p>}
          <p className="text-sm text-slate-700">{plan.summary}</p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Post first on</p>
              <p className="mt-1 text-slate-700">{plan.post_first_on}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Best time</p>
              <p className="mt-1 text-slate-700">{plan.best_time_to_post}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filming checklist</p>
              <ul className="mt-1 list-inside list-disc text-slate-700">{plan.filming_checklist.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
        </Card>
      )}

      <Card title="Hooks" action={<span className="text-xs text-slate-400">Idea: {idea.title}</span>}>
        <ol className="space-y-2">
          {hooks.map((h, i) => (
            <li key={i} className={`rounded-xl border p-3 ${i === bestHookIndex ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{h.text}</p>
                {i === bestHookIndex && <span className="flex-none rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Best</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {h.technique} · On screen: “{h.on_screen_text}” · {h.visual}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        title={`Script — ${script.title}`}
        action={
          <div className="flex items-center gap-2">
            {result.needsReview && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">Needs review</span>
            )}
            <CopyButton text={script.full_voiceover} />
          </div>
        }
      >
        <p className="mb-4 text-xs text-slate-500">
          About {Math.round(script.duration_seconds)} seconds
          {script.cta_keyword && (
            <>
              {' '}· Keyword: <span className="font-semibold text-indigo-600">{script.cta_keyword}</span>
            </>
          )}
        </p>
        <div className="space-y-3">
          {script.beats.map((b, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[90px_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-indigo-600">{b.section}</p>
                <p className="text-xs text-slate-400">{b.time}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-slate-900">{b.voiceover}</p>
                <p className="text-xs text-slate-500">📝 {b.on_screen_text}</p>
                <p className="text-xs text-slate-500">🎥 {b.visual}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {script.fixes?.length > 0 && (
        <Card title={`What the Script Agent changed in draft ${quality.bestAttempt}`}>
          <ul className="space-y-2 text-sm">
            {script.fixes.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-none font-mono text-xs text-slate-400">{f.feedback_id}</span>
                <span className="text-slate-700">{f.what_changed}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Captions" action={<CopyButton text={`${caption.caption}\n\n${caption.hashtags.join(' ')}`} />}>
        <div className="mb-4 flex flex-wrap gap-1">
          {captions.map((c, i) => (
            <button
              key={c.platform}
              onClick={() => setPlatform(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${i === platform ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {c.platform}
            </button>
          ))}
        </div>
        <p className="whitespace-pre-line text-sm text-slate-800">{caption.caption}</p>
        <p className="mt-3 text-sm font-medium text-indigo-600">{caption.hashtags.join(' ')}</p>
        <p className="mt-2 text-xs text-slate-400">Call to action: {caption.cta}</p>
      </Card>

      <Card title="All 10 trending ideas">
        <ol className="grid gap-2 sm:grid-cols-2">
          {result.ideas.map((it, i) => (
            <li key={i} className="rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-900">{it.title}</p>
              <p className="mt-1 text-xs text-slate-500">{it.format} · {it.virality_potential}/10 · {it.angle}</p>
            </li>
          ))}
        </ol>
        {plan?.follow_up_ideas?.length > 0 && (
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-semibold">Series follow-ups:</span> {plan.follow_up_ideas.join(' · ')}
          </p>
        )}
      </Card>
    </div>
  )
}

export default function CreateContent() {
  const { user } = useAuth()
  const brandKey = `viply_brand_${user.email}`
  const dashboard = load(`viply_dashboard_${user.email}`, {})
  const saved = load(brandKey, null)

  const [niche, setNiche] = useState(saved?.niche || dashboard.niche || '')
  const [goal, setGoal] = useState(saved?.goal || 'blogger')
  const [language, setLanguage] = useState(saved?.language || 'English')
  const [customLanguage, setCustomLanguage] = useState('')
  const [brand, setBrand] = useState(saved?.inputs || EMPTY_BRAND)
  const [profile, setProfile] = useState(saved?.profile || null)
  const [editingBrand, setEditingBrand] = useState(!saved?.profile)
  const [steps, setSteps] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => save(brandKey, { niche, goal, language, inputs: brand, profile }), [brandKey, niche, goal, language, brand, profile])
  useEffect(() => () => abortRef.current?.abort(), [])

  function updateBrand(next) {
    setBrand(next)
    setProfile(null) // answers changed → Brand DNA Agent rebuilds the profile on the next run
  }

  function onEvent(evt) {
    if (evt.type === 'step') {
      setSteps((prev) => {
        if (evt.status === 'running' || evt.status === 'skipped') return [...prev, evt]
        const idx = prev.findLastIndex((s) => s.agent === evt.agent && s.status === 'running')
        return idx === -1 ? [...prev, evt] : prev.map((s, i) => (i === idx ? evt : s))
      })
    } else if (evt.type === 'brandProfile') {
      setProfile(evt.profile)
      setEditingBrand(false)
    } else if (evt.type === 'result') {
      setResult(evt.result)
    } else if (evt.type === 'error') {
      setError(evt.message)
    }
  }

  async function generate(e) {
    e.preventDefault()
    const lang = language === 'Other' ? customLanguage.trim() : language
    if (!niche.trim()) return setError('Please enter your niche.')
    if (!lang) return setError('Please type your content language.')
    if (!profile && !brand.examplePosts.some((p) => p.trim()) && !Object.values(brand.answers).some((a) => a.trim())) {
      return setError('Fill in Voice Setup first (at least one post or answer) so the agents can learn your style.')
    }

    setError('')
    setResult(null)
    setSteps([])
    setRunning(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, goal, language: lang, brandProfile: profile, brandInputs: profile ? undefined : brand }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) if (line.trim()) onEvent(JSON.parse(line))
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err instanceof TypeError ? 'Cannot reach the Viply server. Is it running? (npm run dev)' : err.message)
      }
    } finally {
      setRunning(false)
    }
  }

  const languages = [...LANGUAGES, 'Other']

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Create Content</h1>
          <p className="mt-1 text-slate-600">Your AI team researches, writes, checks and packages a ready-to-post video.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <form onSubmit={generate} className="space-y-6">
            <Card title="1. What are we making?">
              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Niche</span>
                  <input
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. home workouts for busy moms, coffee shop in Almaty"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </label>
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">Goal</legend>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {Object.entries(GOALS).map(([id, g]) => (
                      <label
                        key={id}
                        className={`cursor-pointer rounded-xl border p-4 ${goal === id ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20' : 'border-slate-300 hover:border-indigo-300'}`}
                      >
                        <input type="radio" name="goal" value={id} checked={goal === id} onChange={() => setGoal(id)} className="sr-only" />
                        <span className="block font-semibold text-slate-900">{id === 'blogger' ? '🎥' : '💼'} {g.label}</span>
                        <span className="block text-xs text-slate-500">More {g.metrics}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Content language</span>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                    >
                      {languages.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </label>
                  {language === 'Other' && (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Type your language</span>
                      <input
                        value={customLanguage}
                        onChange={(e) => setCustomLanguage(e.target.value)}
                        maxLength={40}
                        placeholder="e.g. Kyrgyz"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500"
                      />
                    </label>
                  )}
                </div>
              </div>
            </Card>

            <Card
              title="2. Brand DNA"
              action={
                profile && (
                  <button type="button" onClick={() => setEditingBrand(!editingBrand)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    {editingBrand ? 'Show profile' : 'Edit Voice Setup'}
                  </button>
                )
              }
            >
              {profile && !editingBrand ? (
                <>
                  <p className="mb-4 text-sm text-slate-500">Every agent follows this profile. Edit your Voice Setup to rebuild it.</p>
                  <ProfileSummary profile={profile} />
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm text-slate-500">
                    Voice Setup: the Brand DNA Agent learns your style from these. You only do this once.
                  </p>
                  <VoiceSetup brand={brand} setBrand={updateBrand} />
                </>
              )}
            </Card>

            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={running}
                className="flex-1 rounded-xl bg-indigo-600 px-6 py-4 font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-60"
              >
                {running ? 'Your AI team is working…' : '⚡ Generate'}
              </button>
              {running && (
                <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-600 hover:border-red-300 hover:text-red-600">
                  Stop
                </button>
              )}
            </div>
          </form>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card title="Agent progress">
              {steps.length === 0 ? (
                <ul className="space-y-2">
                  {PIPELINE.map(([id, name, icon]) => (
                    <li key={id} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 grayscale">{icon}</span>
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <Progress steps={steps} running={running} />
              )}
            </Card>
          </aside>
        </div>

        {result && <Results result={result} />}
      </main>
    </div>
  )
}
