import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import Field from '../components/Field.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form)
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
      title="Welcome back"
      subtitle="Log in to manage your AI content team."
      footer={<>Don’t have an account? <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">Sign up</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={update('password')} placeholder="••••••••" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  )
}
