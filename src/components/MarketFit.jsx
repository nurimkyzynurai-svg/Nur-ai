// "Why this can work now" — the Market Fit Agent's verdict with source links from the Market Brief.

const DIMENSION_LABELS = {
  trend_alignment: 'Trend alignment',
  format_saturation: 'Format freshness',
  platform_fit: 'Platform fit',
  timing: 'Timing',
  differentiation: 'Differentiation',
  goal_fit: 'Goal fit',
}

function SourceChips({ sources }) {
  if (!sources?.length) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {sources.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.url}
            className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-ink/15 bg-white px-2.5 py-1 text-[11px] text-ink hover:border-ink/40"
          >
            <span className="font-semibold">{s.id}</span>
            <span className="truncate">{s.title || s.url}</span>
            {!s.verified && <span className="flex-none rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">Unverified</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function MarketDataUnavailable({ compact = false }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-6'}`}>
      <h2 className="font-display text-xl font-semibold text-ink">Why this can work now</h2>
      <p className="mt-2 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">Market data unavailable.</span> Fresh market research could not be loaded for this niche and
        platform, so this piece was written without trend claims and has no market-fit score. Nothing was guessed.
      </p>
    </div>
  )
}

export default function MarketFitBlock({ fit, brief, compact = false }) {
  if (!fit?.available || !brief) return <MarketDataUnavailable compact={compact} />
  const risk = fit.marketRisk
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${risk ? 'border-amber-300' : 'border-ink/15'}`}>
      <div className={`flex flex-wrap items-center justify-between gap-4 ${compact ? 'p-4' : 'p-6'} bg-gradient-to-r from-ink to-[#2a2f7a] text-white`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Market Fit</p>
          <h2 className="font-display text-2xl font-semibold">Why this can work now</h2>
          <p className="mt-1 text-xs text-white/70">
            Based on the {brief.platform} Market Brief from {new Date(brief.createdAt).toLocaleDateString()} · {brief.sources.length} sources
            {brief.mock ? ' · sample data (MOCK_AI)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {risk && <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">Market risk</span>}
          <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-gold bg-white/5">
            <span className="text-3xl font-bold text-gold">
              {fit.score}
              <span className="text-sm text-white/60">/10</span>
            </span>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${compact ? 'p-4' : 'p-6'} lg:grid-cols-[1fr_260px]`}>
        <div className="space-y-5 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">Why it can work now</p>
            <p className="mt-1 text-slate-800">{fit.whyNow}</p>
            <SourceChips sources={fit.whyNowSources} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Main market risk</p>
            <p className="mt-1 text-slate-800">{fit.mainRisk}</p>
            <SourceChips sources={fit.riskSources} />
          </div>
          <div className="rounded-xl bg-gold-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">One improvement</p>
            <p className="mt-1 text-slate-800">{fit.improvement}</p>
          </div>
          {fit.rewrite && (
            <p className="text-xs text-slate-500">
              {fit.rewrite.kept
                ? `The first draft scored ${fit.rewrite.firstScore}/10 for market fit, so the Script Agent rewrote it once (now ${fit.rewrite.secondScore}/10).`
                : `The first draft scored ${fit.rewrite.firstScore}/10. A market-fit rewrite was tried once but was not better, so the original approved script is kept.`}
              {risk ? ' It is still below 7 — treat it as a market risk and review before posting.' : ''}
            </p>
          )}
          <p className="text-[11px] text-slate-400">A fit score describes how well this matches today’s market signals. It is not a promise of views or results.</p>
        </div>

        <ul className="space-y-2.5">
          {fit.dimensions.map((d) => (
            <li key={d.key} title={d.note}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{DIMENSION_LABELS[d.key] || d.key}</span>
                <span className="font-semibold text-ink">{d.score}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-ink-soft">
                <div className={`h-1.5 rounded-full ${d.score >= 7 ? 'bg-ink' : 'bg-gold'}`} style={{ width: `${d.score * 10}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{d.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
