import { useEffect, useRef, useState } from 'react'
import FeedbackForm from './FeedbackForm.jsx'

/** "Suggest an idea / Report a problem" — a floating button on every dashboard page, opening a dialog. */
export default function FeedbackButton({ email }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      buttonRef.current?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-gold/60 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-ink/10 hover:border-gold hover:shadow-xl sm:bottom-6 sm:right-6"
      >
        <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-gold text-[11px] text-ink">
          ✦
        </span>
        <span className="hidden sm:inline">Suggest an idea / Report a problem</span>
        <span className="sm:hidden">Feedback</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-title" className="font-display text-2xl font-semibold text-ink">
                  Talk to the Viply team
                </h2>
                <p className="mt-1 text-sm text-slate-500">Ideas, problems, questions or partnerships — we read every message.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                ✕
              </button>
            </div>
            <FeedbackForm source="dashboard" defaultEmail={email} autoFocus />
          </div>
        </div>
      )}
    </>
  )
}
