import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { AGENTS, PLANS } from '../data.js'
import { useAuth } from '../context/AuthContext.jsx'
import FeedbackForm from '../components/FeedbackForm.jsx'
import { FAQ, FAQ_SUBTITLE, FAQ_TITLE } from '../content/faq.js'

function Nav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const links = [
    ['#agents', 'AI Agents'],
    ['#how', 'How it works'],
    ['#pricing', 'Pricing'],
    ['#faq', 'FAQ'],
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-8 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-sm font-medium text-slate-600 hover:text-indigo-600">
              {label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link to="/dashboard" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-indigo-600">Log in</Link>
              <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Start free trial
              </Link>
            </>
          )}
        </div>
        <button
          className="rounded-md p-2 text-slate-700 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </nav>
      {open && (
        <div className="space-y-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-slate-700 hover:bg-indigo-50">
              {label}
            </a>
          ))}
          <Link to={user ? '/dashboard' : '/login'} className="block rounded-md px-3 py-2 text-slate-700 hover:bg-indigo-50">
            {user ? 'Dashboard' : 'Log in'}
          </Link>
          {!user && (
            <Link to="/register" className="block rounded-md bg-indigo-600 px-3 py-2 text-center font-semibold text-white">
              Start free trial
            </Link>
          )}
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center">
        <div className="h-[500px] w-[900px] rounded-full bg-gradient-to-br from-indigo-200 via-indigo-100 to-white opacity-70 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
          <span className="h-2 w-2 rounded-full bg-indigo-500" /> 10 AI agents working for you 24/7
        </span>
        <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
          Go Viral. <span className="text-indigo-600">Effortlessly.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
          Viply is your AI content team. Tell it your niche, flip on autopilot, and watch trend-ready posts get
          researched, written, designed and published — while you sleep.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/register" className="w-full rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 sm:w-auto">
            Start creating now
          </Link>
          <a href="#agents" className="w-full rounded-xl border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 sm:w-auto">
            Meet the agents →
          </a>
        </div>
        <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            ['12M+', 'Views generated'],
            ['40K+', 'Posts published'],
            ['8.4x', 'Avg. reach lift'],
            ['15 hrs', 'Saved weekly'],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="text-3xl font-bold text-indigo-600">{value}</dt>
              <dd className="mt-1 text-sm text-slate-500">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Agents() {
  return (
    <section id="agents" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Your AI team</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">10 AI agents. One viral machine.</h2>
          <p className="mt-4 text-lg text-slate-600">
            Each agent is a specialist. Together they handle every step from trend to published post.
          </p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {AGENTS.map((agent, i) => (
            <div
              key={agent.name}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-2xl group-hover:bg-indigo-100">
                  {agent.icon}
                </span>
                <span className="text-xs font-semibold text-slate-300">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-5 font-semibold text-slate-900">{agent.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{agent.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    ['Enter your niche', 'Fitness, finance, cooking, SaaS — tell Viply who you create for.'],
    ['Turn on autopilot', 'Your 10 agents research, write, design and schedule content automatically.'],
    ['Go viral', 'Review your calendar, tweak anything you like, and watch your audience grow.'],
  ]
  return (
    <section id="how" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">How it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">From niche to viral in 3 steps</h2>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map(([title, desc], i) => (
            <div key={title} className="relative rounded-2xl border border-slate-200 p-8">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 font-bold text-white">{i + 1}</span>
              <h3 className="mt-6 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Pricing</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Simple plans. Serious growth.</h2>
          <p className="mt-4 text-lg text-slate-600">Cancel anytime. Every plan starts with a 7-day free trial.</p>
        </div>
        <div className="mx-auto mt-16 grid max-w-6xl gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-8 ${
                plan.popular
                  ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 lg:scale-105'
                  : 'border border-slate-200 bg-white'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600 shadow">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className={`mt-2 text-sm ${plan.popular ? 'text-indigo-100' : 'text-slate-500'}`}>{plan.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight">${plan.price}</span>
                <span className={plan.popular ? 'text-indigo-200' : 'text-slate-500'}>/month</span>
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <svg className={`mt-0.5 h-5 w-5 flex-none ${plan.popular ? 'text-indigo-200' : 'text-indigo-600'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={`/register?plan=${plan.id}`}
                className={`mt-8 block rounded-xl px-6 py-3 text-center font-semibold ${
                  plan.popular ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Choose {plan.name}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-8 py-16 text-center text-white">
          <h2 className="text-4xl font-bold tracking-tight">Your next viral post is one click away.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">Join thousands of creators who let Viply run their content engine.</p>
          <Link to="/register" className="mt-8 inline-block rounded-xl bg-white px-8 py-4 font-semibold text-indigo-600 hover:bg-indigo-50">
            Get started free
          </Link>
        </div>
      </div>
    </section>
  )
}

function FaqItem({ item, index, open, onToggle }) {
  const id = `faq-${index}`
  return (
    <li className="border-b border-ink/10 last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 rounded-lg py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4"
        >
          <span className="text-base font-semibold text-ink sm:text-lg">{item.q}</span>
          <span
            aria-hidden="true"
            className={`grid h-8 w-8 flex-none place-items-center rounded-full border text-lg transition ${
              open ? 'rotate-45 border-gold bg-gold text-ink' : 'border-ink/20 text-ink'
            }`}
          >
            +
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p className="max-w-3xl leading-relaxed text-slate-600">{item.a}</p>
        </div>
      </div>
    </li>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">FAQ</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink">{FAQ_TITLE}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{FAQ_SUBTITLE}</p>
        </div>
        <ul className="mt-12 rounded-3xl border border-ink/10 bg-white px-5 shadow-sm shadow-ink/5 sm:px-8">
          {FAQ.map((item, i) => (
            <FaqItem key={item.q} item={item} index={i} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </ul>
      </div>
    </section>
  )
}

// Shown only if VITE_CONTACT_EMAIL is set in .env; otherwise the contact block shows just the form.
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL || '').trim()

function Footer() {
  return (
    <footer id="contact" className="border-t border-ink/10 bg-ink-soft/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_440px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Contact</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Partnerships and support</h2>
          <p className="mt-3 max-w-md text-slate-600">
            Questions, problems, partnership ideas or early-access requests — send us a message and a real person will read it.
          </p>
          {CONTACT_EMAIL && (
            <p className="mt-6">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
              <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 inline-block break-all font-display text-xl font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4">
                {CONTACT_EMAIL}
              </a>
            </p>
          )}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <Logo />
            <p className="text-sm text-slate-500">© {new Date().getFullYear()} Viply. All rights reserved.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-sm shadow-ink/5">
          <FeedbackForm source="landing" defaultType="question" />
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Agents />
        <HowItWorks />
        <Pricing />
        <CTA />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
