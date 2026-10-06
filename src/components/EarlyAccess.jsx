import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import FeedbackForm from './FeedbackForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export const EARLY_ACCESS_LINE = 'Early access: try Viply free on your own brand (3 generations), then lock in a founding-member price.'

/** "Join early access" button + dialog. Sends an early-access request to the team (admin → Feedback). */
export function JoinEarlyAccessButton({ className = '', label = 'Join early access' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-ink shadow-sm hover:brightness-95'}
      >
        {label}
      </button>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ea-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="ea-title" className="font-display text-2xl font-semibold text-ink">
                  Join early access
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Founding members lock in their price. Payments aren’t switched on yet — we’ll write to you before anything is charged.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                ✕
              </button>
            </div>
            <FeedbackForm
              source="dashboard"
              fixedType="early_access"
              defaultEmail={user?.email || ''}
              messagePlaceholder="Tell us about your brand and which plan you’re interested in."
              submitLabel="Request early access"
              autoFocus
            />
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}

/** "2 of 3 free generations left" — shown next to every Generate button. */
export function UsagePill({ usage }) {
  if (!usage) return null
  if (usage.unlimited) return <span className="rounded-full bg-ink-soft px-3 py-1 text-xs font-semibold text-ink">Team account · no limit</span>
  const out = usage.remaining === 0
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${out ? 'bg-amber-100 text-amber-800' : 'bg-gold-soft text-ink'}`}>
      {usage.remaining} of {usage.limit} free generation{usage.limit === 1 ? '' : 's'} left
    </span>
  )
}

/** Friendly panel when the free generations are used up. */
export function LimitReached({ message }) {
  return (
    <div role="status" className="rounded-2xl border border-gold/60 bg-gold-soft p-5">
      <p className="font-display text-xl font-semibold text-ink">You’ve reached the free limit</p>
      <p className="mt-1 text-sm text-ink/80">{message || 'You’ve used your free generations. Join early access to keep creating.'}</p>
      <p className="mt-1 text-xs text-ink/60">Everything you already created stays in your calendar and Content Plan.</p>
      <div className="mt-4">
        <JoinEarlyAccessButton />
      </div>
    </div>
  )
}
