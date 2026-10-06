import { NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PLANS } from '../data.js'

const TABS = [
  ['/dashboard', 'Overview', 'Home'],
  ['/dashboard/create', 'Create Content', 'Create'],
  ['/dashboard/plan', 'Content Plan', 'Plan'],
]
const ADMIN_TAB = ['/admin/market-intel', 'Market Intel', 'Intel']

// Who sees the admin tab. The admin API itself is protected by ADMIN_TOKEN on the server.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
export const isAdmin = (user) => ADMIN_EMAILS.includes(user?.email?.toLowerCase())

export default function DashboardHeader() {
  const { user, logout } = useAuth()
  const plan = PLANS.find((p) => p.id === user.plan) || PLANS[1]
  const tabs = isAdmin(user) ? [...TABS, ADMIN_TAB] : TABS

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Logo compact />
          <nav className="flex min-w-0 gap-1 overflow-x-auto">
            {tabs.map(([to, label, short]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium sm:px-3 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600'}`
                }
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-none items-center gap-4">
          <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 lg:inline">{plan.name} plan</span>
          <div className="hidden text-right lg:block">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button onClick={logout} className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
