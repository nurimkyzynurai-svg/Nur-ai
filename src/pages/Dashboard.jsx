import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardHeader from '../components/DashboardHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PLANS } from '../data.js'

const PLATFORMS = {
  TikTok: 'bg-slate-900 text-white',
  Instagram: 'bg-pink-100 text-pink-700',
  YouTube: 'bg-red-100 text-red-700',
  LinkedIn: 'bg-sky-100 text-sky-700',
  X: 'bg-slate-100 text-slate-700',
}
// Styles for every platform a post can have.
const PLATFORM_STYLE = {
  ...PLATFORMS,
  Threads: 'bg-slate-800 text-white',
  Facebook: 'bg-blue-100 text-blue-700',
  Telegram: 'bg-cyan-100 text-cyan-700',
}
const platformStyle = (p) => PLATFORM_STYLE[p] || 'bg-slate-100 text-slate-700'

function PlanPostDetails({ post }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <p className="text-xs text-indigo-600">
        📋 {post.campaign}
        {post.needsReview ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Needs review</span> : null}
        {post.marketRisk ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Market risk</span> : null}
        <button onClick={() => setOpen(!open)} className="ml-2 font-medium underline">
          {open ? 'Hide' : 'Script & caption'}
        </button>
      </p>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
          {post.hook && <p><span className="font-semibold">Hook:</span> {post.hook}</p>}
          <p className="whitespace-pre-line"><span className="font-semibold">Voiceover:</span> {post.voiceover}</p>
          {post.caption && <p className="whitespace-pre-line"><span className="font-semibold">Caption:</span> {post.caption}</p>}
          <Link to="/dashboard/plan" className="font-medium text-indigo-600">Open in Content Plan →</Link>
        </div>
      )}
    </div>
  )
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const pad = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayKey = () => toKey(new Date())

function storageKey(email) {
  return `viply_dashboard_${email}`
}

function loadState(email) {
  try {
    const raw = localStorage.getItem(storageKey(email))
    if (raw) {
      const state = JSON.parse(raw)
      // Older versions filled the calendar with placeholder "autopilot" posts; they were never real content.
      return { ...state, posts: (state.posts || []).filter((p) => p.source !== 'autopilot') }
    }
  } catch {
    // fall through to defaults
  }
  return { niche: '', posts: [] }
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function Calendar({ posts, month, setMonth, selected, setSelected }) {
  const byDate = useMemo(() => {
    const map = {}
    for (const p of posts) (map[p.date] ||= []).push(p)
    return map
  }, [posts])

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // Monday-first grid
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1
    return day >= 1 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null
  })
  const today = todayKey()
  const shift = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Previous month">‹</button>
          <button
            onClick={() => {
              const now = new Date()
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
              setSelected(today)
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Today
          </button>
          <button onClick={() => shift(1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Next month">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-20 border-b border-r border-slate-50 bg-slate-50/50 sm:min-h-28" />
          const key = toKey(date)
          const dayPosts = byDate[key] || []
          const isSelected = key === selected
          return (
            <button
              key={i}
              onClick={() => setSelected(key)}
              className={`min-h-20 border-b border-r border-slate-100 p-1.5 text-left align-top transition sm:min-h-28 sm:p-2 ${
                isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                  key === today ? 'bg-indigo-600 text-white' : key < today ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayPosts.slice(0, 2).map((p) => (
                  <div key={p.id} className={`hidden truncate rounded px-1.5 py-0.5 text-[11px] font-medium sm:block ${platformStyle(p.platform)}`}>
                    {p.time} {p.format}
                  </div>
                ))}
                {dayPosts.length > 0 && (
                  <div className="flex gap-0.5 sm:hidden">
                    {dayPosts.map((p) => <span key={p.id} className="h-1.5 w-1.5 rounded-full bg-indigo-500" />)}
                  </div>
                )}
                {dayPosts.length > 2 && <div className="hidden text-[11px] text-slate-400 sm:block">+{dayPosts.length - 2} more</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayPanel({ dateKey, posts, onAdd, onDelete }) {
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('TikTok')
  const [time, setTime] = useState('12:00')
  const date = new Date(`${dateKey}T00:00:00`)
  const dayPosts = posts.filter((p) => p.date === dateKey).sort((a, b) => a.time.localeCompare(b.time))

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ id: `manual-${Date.now()}`, date: dateKey, time, platform, format: 'Post', title: title.trim(), source: 'manual' })
    setTitle('')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
      <p className="text-sm text-slate-500">{dayPosts.length} post{dayPosts.length === 1 ? '' : 's'} planned</p>
      <ul className="mt-4 space-y-3">
        {dayPosts.length === 0 && <li className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">Nothing scheduled yet.</li>}
        {dayPosts.map((p) => (
          <li key={p.id} className="group rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${platformStyle(p.platform)}`}>{p.platform}</span>
                <span className="text-xs text-slate-400">{p.time} · {p.format}</span>
              </div>
              <button onClick={() => onDelete(p.id)} className="text-xs text-slate-400 hover:text-red-600" aria-label="Delete post">✕</button>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-800">{p.title}</p>
            {p.source === 'plan' && <PlanPostDetails post={p} />}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-5 space-y-2 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">Add a post</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post idea or title"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="flex gap-2">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-indigo-500">
            {Object.keys(PLATFORMS).map((p) => <option key={p}>{p}</option>)}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-indigo-500" />
        </div>
        <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add to calendar</button>
      </form>
    </div>
  )
}

export default function Dashboard() {
  const { user, usage } = useAuth()
  const [state, setState] = useState(() => loadState(user.email))
  const [nicheDraft, setNicheDraft] = useState(state.niche)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selected, setSelected] = useState(todayKey())
  const plan = PLANS.find((p) => p.id === user.plan) || PLANS[1]

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user.email), JSON.stringify(state))
    } catch {
      // storage unavailable
    }
  }, [state, user.email])

  function saveNiche(e) {
    e.preventDefault()
    const niche = nicheDraft.trim()
    if (!niche) return
    setState((s) => ({ ...s, niche }))
  }

  const upcoming = state.posts.filter((p) => p.date >= todayKey()).length
  const firstName = user.name.split(' ')[0]

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Hey {firstName} 👋</h1>
          <p className="mt-1 text-slate-600">Create content, plan campaigns and keep track of what goes out when.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveNiche} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">Your niche</h2>
            <p className="mt-1 text-sm text-slate-500">Used as the starting niche in Create Content and Content Plan.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={nicheDraft}
                onChange={(e) => setNicheDraft(e.target.value)}
                placeholder="Your niche or industry — who you serve and what you offer"
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">Save</button>
            </div>
            {state.niche && (
              <p className="mt-3 text-sm text-slate-600">
                Current niche: <span className="font-semibold text-indigo-600">{state.niche}</span>
              </p>
            )}
          </form>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="font-semibold text-slate-900">Start creating</h2>
              <p className="mt-1 text-sm text-slate-500">
                Generate one piece with the full agent team, or bring a campaign plan. Finished pieces land in your calendar.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/dashboard/create" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                Create Content
              </Link>
              <Link to="/dashboard/plan" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600">
                Content Plan
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Autopilot and automatic publishing are planned, not available yet — today you post the content yourself.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Planned posts" value={upcoming} hint="In your calendar, today and later" />
          <StatCard label="Ready content" value={state.posts.filter((p) => p.source === 'plan').length} hint="Generated plan days in the calendar" />
          <StatCard
            label="Free generations left"
            value={usage ? (usage.unlimited ? '∞' : `${usage.remaining} / ${usage.limit}`) : '—'}
            hint={usage?.unlimited ? 'Team account' : 'Early access'}
          />
          <StatCard label="Plan you chose" value={plan.name} hint={`$${plan.price}/month · payments not live yet`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Calendar posts={state.posts} month={month} setMonth={setMonth} selected={selected} setSelected={setSelected} />
          <DayPanel
            dateKey={selected}
            posts={state.posts}
            onAdd={(post) => setState((s) => ({ ...s, posts: [...s.posts, post] }))}
            onDelete={(id) => setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }))}
          />
        </div>
      </main>
    </div>
  )
}
