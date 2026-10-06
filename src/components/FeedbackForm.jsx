import { useState } from 'react'
import VoiceInput from './VoiceInput.jsx'

export const FEEDBACK_TYPES = [
  ['idea', 'Idea'],
  ['problem', 'Problem'],
  ['question', 'Question'],
  ['partnership', 'Partnership'],
]
const MAX_MESSAGE = 2000
const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-ink focus:ring-2 focus:ring-ink/15'

/** Feedback form used in the dashboard pop-up, the landing contact block and the early-access request.
 *  fixedType hides the type picker (used for "early_access"). */
export default function FeedbackForm({ source, defaultEmail = '', defaultType = 'idea', fixedType, messagePlaceholder, submitLabel = 'Send', onSent, autoFocus = false }) {
  const [type, setType] = useState(fixedType || defaultType)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [website, setWebsite] = useState('') // honeypot: hidden from people, bots fill it in
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    e.stopPropagation() // this form can sit inside another form's React tree (e.g. the early-access dialog)
    if (message.trim().length < 5) return setError('Please write a few words.')
    setError('')
    setStatus('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, email, website, source, page: window.location.pathname }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`)
      setStatus('sent')
      onSent?.()
    } catch (err) {
      setStatus('idle')
      setError(err instanceof TypeError ? 'Could not reach the Viply server. Please try again later.' : err.message)
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl bg-ink-soft p-5 text-sm text-ink" role="status">
        <p className="font-semibold">Thank you — your message was received.</p>
        <p className="mt-1 text-ink/80">{email ? 'If a reply is needed, we’ll write to the email you gave.' : 'You didn’t leave an email, so we can’t reply directly — but we read every message.'}</p>
        <button
          type="button"
          onClick={() => {
            setMessage('')
            setStatus('idle')
          }}
          className="mt-3 text-sm font-semibold text-ink underline"
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!fixedType && (
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">What is it about?</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FEEDBACK_TYPES.map(([id, label]) => (
            <label
              key={id}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition ${
                type === id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <input type="radio" name={`feedback-type-${source}`} value={id} checked={type === id} onChange={() => setType(id)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      )}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Message</span>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          maxLength={MAX_MESSAGE}
          autoFocus={autoFocus}
          required
          placeholder={messagePlaceholder || (type === 'problem' ? 'What happened, and what did you expect?' : 'Tell us in your own words…')}
          className={`mt-1 ${field}`}
        />
        <span className="mt-1 block text-right text-[11px] text-slate-400">
          {message.length}/{MAX_MESSAGE}
        </span>
      </label>
      <VoiceInput value={message} onChange={setMessage} language={typeof navigator !== 'undefined' ? navigator.language : 'English'} maxLength={MAX_MESSAGE} className="-mt-3" />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Email <span className="font-normal text-slate-400">(optional — only if you want a reply)</span>
        </span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 254))} maxLength={254} autoComplete="email" className={`mt-1 ${field}`} />
      </label>
      {/* Honeypot field — invisible to people and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink/90 disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  )
}
