import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import Field from '../components/Field.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PLANS } from '../data.js'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialPlan = PLANS.some((p) => p.id === params.get('plan')) ? params.get('plan') : 'pro'
  const [form, setForm] = useState({ name: '', email: '', password: '', plan: initialPlan })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Early access: try Viply free on your own brand (3 generations), then lock in a founding-member price."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Full name" autoComplete="name" required value={form.name} onChange={update('name')} placeholder="Jane Creator" />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
        <Field label="Password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={update('password')} placeholder="At least 8 characters" />
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Plan you’re interested in <span className="font-normal text-slate-400">(no payment now)</span></legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {PLANS.map((plan) => (
              <label
                key={plan.id}
                className={`cursor-pointer rounded-lg border px-2 py-2.5 text-center transition ${
                  form.plan === plan.id ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20' : 'border-slate-300 hover:border-indigo-300'
                }`}
              >
                <input type="radio" name="plan" value={plan.id} checked={form.plan === plan.id} onChange={update('plan')} className="sr-only" />
                <span className="block text-sm font-semibold text-slate-900">{plan.name}</span>
                <span className="block text-xs text-slate-500">${plan.price}/mo</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
