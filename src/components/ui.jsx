import { useState } from 'react'

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
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

export function CopyButton({ text }) {
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

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
