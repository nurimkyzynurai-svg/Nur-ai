import { useCallback, useEffect, useState } from 'react'
import DashboardHeader from '../components/DashboardHeader.jsx'
import { ANY_PLATFORM, BRIEF_SECTIONS, LANGUAGES, TARGET_PLATFORMS } from '../agents/shared.js'

const TOKEN_KEY = 'viply_admin_token'

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Server error (${res.status})`), { status: res.status })
  return data
}

const host = (url) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
const usd = (n) => (n == null ? '—' : `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`)
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function Badge({ verified, flags = [] }) {
  return verified ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Verified</span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800" title={flags.join(', ')}>
      ⚠ Unverified{flags.length ? ` · ${flags.join(', ')}` : ''}
    </span>
  )
}

function SourceLinks({ ids, sources }) {
  const list = ids.map((id) => sources.find((s) => s.id === id)).filter(Boolean)
  if (!list.length) return <span className="text-xs text-amber-700">No source</span>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {list.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline" title={s.url}>
          [{s.id}] {s.title ? (s.title.length > 50 ? `${s.title.slice(0, 50)}…` : s.title) : host(s.url)}
        </a>
      ))}
    </span>
  )
}

function Items({ items, sources, extra }) {
  if (!items?.length) return <p className="text-sm text-slate-400">Nothing reliable found this time.</p>
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="rounded-xl border border-slate-100 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{it.title}</p>
            <Badge verified={it.verified} flags={it.flags} />
            {it.platform && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{it.platform}</span>}
            {extra?.(it)}
            {it.date_seen && <span className="text-[11px] text-slate-400">{it.date_seen}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{it.detail}</p>
          <div className="mt-2">
            <SourceLinks ids={it.source_ids} sources={sources} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function CostLine({ cost, durationMs }) {
  if (!cost) return null
  return (
    <p className="text-xs text-slate-500">
      Cost {usd(cost.usd)} (estimate was ≤ {usd(cost.estimateUsd)}) · {cost.webSearches}/{cost.maxSearches} searches ·{' '}
      {Math.round((cost.inputTokens + cost.cacheReadTokens + cost.cacheWriteTokens) / 1000)}k in / {Math.round(cost.outputTokens / 1000)}k out tokens
      {durationMs ? ` · ${Math.round(durationMs / 1000)}s` : ''}
    </p>
  )
}

function MockNote({ item }) {
  return item?.mock ? (
    <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Sample data (MOCK_AI mode) — no real research was done.</p>
  ) : null
}

function FounderReport({ report }) {
  return (
    <div className="space-y-6">
      <MockNote item={report} />
      <p className="text-sm text-slate-700">{report.summary}</p>
      <CostLine cost={report.cost} durationMs={report.durationMs} />

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">What Viply should add</h3>
        {report.suggestions.length === 0 ? (
          <p className="text-sm text-slate-400">No suggestions this week.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {report.suggestions.map((s, i) => (
              <li key={i} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <p className="font-semibold text-slate-900">{s.title}</p>
                <p className="mt-1 text-sm text-slate-600">{s.why}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-white px-1.5 py-0.5 text-slate-600">Impact: {s.impact}</span>
                  <span className="rounded bg-white px-1.5 py-0.5 text-slate-600">Effort: {s.effort}</span>
                  <SourceLinks ids={s.source_ids} sources={report.sources} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">New AI models (video · voice · image)</h3>
        <Items items={report.ai_models} sources={report.sources} extra={(it) => <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700">{it.category}</span>} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">Competitor updates</h3>
        <Items items={report.competitor_updates} sources={report.sources} extra={(it) => <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{it.competitor}</span>} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">Platform API changes</h3>
        <Items items={report.platform_api_changes} sources={report.sources} />
      </div>
    </div>
  )
}

function Brief({ brief }) {
  return (
    <div className="space-y-5">
      <MockNote item={brief} />
      <p className="text-sm text-slate-700">{brief.summary}</p>
      <CostLine cost={brief.cost} durationMs={brief.durationMs} />
      {BRIEF_SECTIONS.map(([key, label]) => (
        <div key={key}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">{label}</h3>
          <Items items={brief[key]} sources={brief.sources} />
        </div>
      ))}
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500">All {brief.sources.length} sources</summary>
        <ol className="mt-2 space-y-1">
          {brief.sources.map((s) => (
            <li key={s.id} className="text-xs">
              <span className="text-slate-400">{s.id}</span>{' '}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                {s.title || s.url}
              </a>
              {s.pageAge && <span className="text-slate-400"> · {s.pageAge}</span>}
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}

function TokenGate({ onSave, error }) {
  const [value, setValue] = useState('')
  return (
    <Card title="Admin access">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setToken(value.trim())
          onSave()
        }}
        className="flex max-w-lg flex-col gap-2 sm:flex-row"
      >
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ADMIN_TOKEN from your .env file"
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">Unlock</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  )
}

const FEEDBACK_LABELS = { idea: 'Idea', problem: 'Problem', question: 'Question', partnership: 'Partnership', early_access: 'Early access' }
const FEEDBACK_STYLE = {
  idea: 'bg-gold-soft text-ink',
  problem: 'bg-red-50 text-red-700',
  question: 'bg-ink-soft text-ink',
  partnership: 'bg-emerald-50 text-emerald-700',
  early_access: 'bg-ink text-gold',
}

function FeedbackPanel() {
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('open')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await api('/api/admin/feedback'))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function toggle(item) {
    setItems((list) => list.map((f) => (f.id === item.id ? { ...f, done: !f.done } : f)))
    try {
      await api(`/api/admin/feedback/${item.id}`, { method: 'PATCH', body: { done: !item.done } })
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  if (!items) return <p className="text-sm text-slate-500">{error || 'Loading…'}</p>
  const open = items.filter((f) => !f.done).length
  const shown = filter === 'open' ? items.filter((f) => !f.done) : items
  return (
    <Card
      title={`Feedback · ${open} open of ${items.length}`}
      action={
        <div className="flex items-center gap-2">
          {['open', 'all'].map((id) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {id === 'open' ? 'Open' : 'All'}
            </button>
          ))}
          <button onClick={load} className="text-xs font-medium text-indigo-600">
            Reload
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">{filter === 'open' ? 'Nothing open — all caught up.' : 'No messages yet.'}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((f) => (
            <li key={f.id} className={`rounded-xl border p-4 ${f.done ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${FEEDBACK_STYLE[f.type] || 'bg-slate-100'}`}>{FEEDBACK_LABELS[f.type] || f.type}</span>
                <span className="text-slate-500">{when(f.createdAt)}</span>
                <span className="text-slate-400">· from {f.source}{f.page ? ` (${f.page})` : ''}</span>
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 font-medium text-slate-600">
                  <input type="checkbox" checked={f.done} onChange={() => toggle(f)} />
                  Done
                </label>
              </div>
              <p className={`mt-2 whitespace-pre-line text-sm ${f.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{f.message}</p>
              {f.email && (
                <a href={`mailto:${f.email}`} className="mt-2 inline-block text-xs font-medium text-indigo-600">
                  Reply to {f.email}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function MarketIntel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [needsToken, setNeedsToken] = useState(!getToken())
  const [tab, setTab] = useState('report')
  const [openNiche, setOpenNiche] = useState(null)
  const [newNiche, setNewNiche] = useState('')
  const [newPlatform, setNewPlatform] = useState(ANY_PLATFORM)
  const [newLanguage, setNewLanguage] = useState('English')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const next = await api('/api/admin/market-intel')
      setData(next)
      if (!next.running.length) setNotice('')
      setError('')
      setNeedsToken(false)
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        setNeedsToken(true)
        if (err.status === 401) setToken('')
      }
      setError(err instanceof TypeError ? 'Cannot reach the Viply server. Is it running?' : err.message)
    }
  }, [])

  useEffect(() => {
    if (!needsToken) load()
  }, [needsToken, load])

  // While research is running, refresh every 4 seconds.
  const running = data?.running || []
  useEffect(() => {
    if (!running.length) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [running.length, load])

  async function start(path, body, estimate, label) {
    if (!window.confirm(`${label}\n\nEstimated cost: up to ${usd(estimate)} (web searches + tokens). Continue?`)) return
    try {
      await api(path, { method: 'POST', body })
      setNotice(`${label} started — this takes 1–3 minutes.`)
      setTimeout(load, 500)
    } catch (err) {
      setError(err.message)
    }
  }

  const same = (a = '', b = '') => a.toLowerCase() === b.toLowerCase()
  const isRunning = (type, combo) =>
    running.some((r) => r.type === type && (!combo || (same(r.niche, combo.niche) && same(r.platform, combo.platform) && same(r.language, combo.language))))
  const comboLabel = (c) => `“${c.niche}” · ${c.platform} · ${c.language}`
  const report = data?.reports?.[0]
  const cfg = data?.config

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Market Intel</h1>
            <p className="mt-1 text-slate-600">Live web research with sources. Daily briefs per niche, weekly AI &amp; Market Report.</p>
          </div>
          {!needsToken && (
            <button
              onClick={() => {
                setToken('')
                setNeedsToken(true)
                setData(null)
              }}
              className="text-sm text-slate-500 hover:text-red-600"
            >
              Lock
            </button>
          )}
        </div>

        {needsToken ? (
          <TokenGate onSave={() => setNeedsToken(false)} error={error} />
        ) : !data ? (
          <p className="text-slate-500">{error || 'Loading…'}</p>
        ) : (
          <>
            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            {notice && <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{notice}</p>}
            {cfg.mock && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">MOCK_AI mode: runs return sample data and cost nothing.</p>}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                ['Spent, last 30 days', usd(data.costs.last30DaysUsd), `${data.costs.runs} runs · ${data.costs.failures} failed`],
                ['Per niche brief', `≤ ${usd(cfg.briefEstimateUsd)}`, `max ${cfg.briefMaxSearches} searches`],
                ['Per founder report', `≤ ${usd(cfg.reportEstimateUsd)}`, `max ${cfg.reportMaxSearches} searches`],
                ['Scheduler', cfg.schedulerEnabled ? 'On' : 'Off', cfg.schedulerEnabled ? `≤ ${cfg.maxScheduledBriefsPerDay} niche briefs / day` : 'On demand + Refresh now'],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                  <p className="mt-1 text-xs text-slate-400">{hint}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                ['report', 'AI & Market Report'],
                ['briefs', `Niche briefs (${data.briefs.length})`],
                ['runs', 'Run log'],
                ['feedback', 'Feedback'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'report' && (
              <Card
                title={report ? `AI & Market Report — ${when(report.createdAt)}` : 'AI & Market Report'}
                action={
                  <button
                    disabled={isRunning('founder-report')}
                    onClick={() => start('/api/admin/founder-report/run', null, cfg.reportEstimateUsd, 'New AI & Market Report')}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isRunning('founder-report') ? 'Researching…' : 'Run now'}
                  </button>
                }
              >
                {report ? <FounderReport report={report} /> : <p className="text-sm text-slate-500">No report yet. It runs once a week automatically, or click “Run now”.</p>}
                {data.reports.length > 1 && (
                  <p className="mt-6 text-xs text-slate-400">Earlier reports: {data.reports.slice(1).map((r) => when(r.createdAt)).join(' · ')}</p>
                )}
              </Card>
            )}

            {tab === 'briefs' && (
              <Card
                title="Market Briefs (niche · platform · language)"
                action={
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const combo = { niche: newNiche.trim(), platform: newPlatform, language: newLanguage }
                      if (combo.niche) start('/api/admin/briefs/run', combo, cfg.briefEstimateUsd, `Market Brief for ${comboLabel(combo)}`)
                      setNewNiche('')
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      value={newNiche}
                      onChange={(e) => setNewNiche(e.target.value)}
                      maxLength={200}
                      placeholder="Niche"
                      className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 sm:w-52"
                    />
                    <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" aria-label="Platform">
                      {[ANY_PLATFORM, ...TARGET_PLATFORMS].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    <select value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" aria-label="Language">
                      {LANGUAGES.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Research</button>
                  </form>
                }
              >
                <p className="mb-3 text-xs text-slate-500">
                  Briefs are shared by every client with the same niche, platform and language, and refreshed at most once a day. With the scheduler off,
                  they are made on demand when a client generates content — or here with “Refresh now”.
                </p>
                {data.briefs.length === 0 ? (
                  <p className="text-sm text-slate-500">No briefs yet. One is added automatically the first time a client generates content.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.briefs.map((b) => {
                      const { key, latest, lastRequestedAt } = b
                      const combo = { niche: b.niche, platform: b.platform, language: b.language }
                      return (
                        <li key={key} className="py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button onClick={() => setOpenNiche(openNiche === key ? null : key)} className="min-w-0 text-left">
                              <p className="font-medium text-slate-900">
                                {b.niche} <span className="text-sm font-normal text-slate-500">· {b.platform} · {b.language}</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {latest ? `Brief ${when(latest.createdAt)} · ${latest.sources.length} sources · ${usd(latest.cost?.usd)}` : 'No brief yet'} · last used {when(lastRequestedAt)}
                              </p>
                            </button>
                            <div className="flex items-center gap-2">
                              {latest && (
                                <button onClick={() => setOpenNiche(openNiche === key ? null : key)} className="text-sm font-medium text-indigo-600">
                                  {openNiche === key ? 'Hide' : 'View'}
                                </button>
                              )}
                              <button
                                disabled={isRunning('brief', combo)}
                                onClick={() => start('/api/admin/briefs/run', combo, cfg.briefEstimateUsd, `Market Brief for ${comboLabel(combo)}`)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60"
                              >
                                {isRunning('brief', combo) ? 'Researching…' : 'Refresh now'}
                              </button>
                            </div>
                          </div>
                          {openNiche === key && latest && (
                            <div className="mt-4 rounded-xl bg-slate-50 p-4">
                              <Brief brief={latest} />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )}

            {tab === 'feedback' && <FeedbackPanel />}

            {tab === 'runs' && (
              <Card title="Recent research runs">
                {data.recentRuns.length === 0 ? (
                  <p className="text-sm text-slate-500">No runs yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-400">
                        <tr>
                          <th className="py-2 pr-4">When</th>
                          <th className="py-2 pr-4">What</th>
                          <th className="py-2 pr-4">Trigger</th>
                          <th className="py-2 pr-4">Searches</th>
                          <th className="py-2 pr-4">Cost</th>
                          <th className="py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.recentRuns.map((r, i) => (
                          <tr key={i}>
                            <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{when(r.at)}</td>
                            <td className="py-2 pr-4">{r.type === 'brief' ? `Brief: ${r.niche}` : 'Founder report'}</td>
                            <td className="py-2 pr-4 text-slate-500">{r.trigger}</td>
                            <td className="py-2 pr-4 text-slate-500">{r.searches ?? '—'}</td>
                            <td className="py-2 pr-4">{usd(r.usd)}</td>
                            <td className="py-2">{r.ok ? <span className="text-emerald-600">OK</span> : <span className="text-red-600">{r.error}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
