import { Link } from 'react-router-dom'

export default function Logo({ className = '', compact = false }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold text-xl tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
          <path d="M9 10l7 13 7-13" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={compact ? 'hidden text-slate-900 sm:inline' : 'text-slate-900'}>Viply</span>
    </Link>
  )
}
