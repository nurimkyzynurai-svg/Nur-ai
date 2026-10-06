import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import VoiceInput from './VoiceInput.jsx'
import { suggestNicheLabel } from '../lib/niche.js'

export const NICHE_PLACEHOLDER =
  'Describe your niche in your own words: what you sell or create, for whom, where, and what makes you different.'
const MAX_DESCRIPTION = 1000

/** Textarea that starts at `minRows` and grows with its content (up to `maxRows`, then scrolls). */
export function AutoGrowTextarea({ value, minRows = 2, maxRows = 10, className = '', ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const line = parseFloat(cs.lineHeight) || 20
    const max = line * maxRows + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const border = el.offsetHeight - el.clientHeight
    el.style.height = 'auto' // `rows={minRows}` sets the natural minimum
    el.style.height = `${Math.min(el.scrollHeight, max) + border}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [value, minRows, maxRows])
  return <textarea ref={ref} value={value} rows={minRows} className={`resize-none ${className}`} {...props} />
}

/**
 * The niche, described in the client's own words (typed or dictated), plus a short editable label.
 * value: { niche, nicheDescription, nicheLabelEdited }; onChange(patch).
 */
export default function NicheField({ value, onChange, language, title = 'Your niche', compact = false }) {
  const [suggesting, setSuggesting] = useState(false)
  const description = value.nicheDescription || ''
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Suggest the short label ~1s after the description stops changing, unless the user edited it.
  useEffect(() => {
    if (value.nicheLabelEdited || description.trim().length < 3) return
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setSuggesting(true)
      try {
        const label = await suggestNicheLabel(description.trim(), controller.signal)
        if (label) onChangeRef.current({ niche: label })
      } catch {
        // aborted — a newer description is on its way
      } finally {
        setSuggesting(false)
      }
    }, 1100)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [description, value.nicheLabelEdited])

  const field =
    'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div>
      <label className="block">
        <span className={compact ? 'text-sm font-medium text-slate-700' : 'font-semibold text-slate-900'}>{title}</span>
        <AutoGrowTextarea
          value={description}
          onChange={(e) => onChange({ nicheDescription: e.target.value.slice(0, MAX_DESCRIPTION) })}
          maxLength={MAX_DESCRIPTION}
          minRows={compact ? 2 : 3}
          placeholder={NICHE_PLACEHOLDER}
          className={`mt-1.5 ${field}`}
        />
      </label>
      <VoiceInput value={description} onChange={(v) => onChange({ nicheDescription: v })} language={language} maxLength={MAX_DESCRIPTION} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex-none text-xs font-semibold uppercase tracking-wide text-slate-500">Short label</span>
          <input
            value={value.niche || ''}
            onChange={(e) => onChange({ niche: e.target.value.slice(0, 60), nicheLabelEdited: true })}
            maxLength={60}
            placeholder={suggesting ? 'Suggesting…' : '1–5 words'}
            aria-describedby="niche-label-help"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-indigo-500 focus:bg-white"
          />
        </label>
        {suggesting && <span className="text-xs text-slate-400">Suggesting…</span>}
        {value.nicheLabelEdited && description.trim().length >= 3 && (
          <button type="button" onClick={() => onChange({ nicheLabelEdited: false })} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            Auto-suggest again
          </button>
        )}
      </div>
      <p id="niche-label-help" className="mt-1 text-[11px] text-slate-400">
        The label is for your dashboard and market research. The agents read your full description.
      </p>
    </div>
  )
}
