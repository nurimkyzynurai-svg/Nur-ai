import Logo from './Logo.jsx'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-slate-600">{footer}</p>
        </div>
      </div>
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-indigo-600 lg:flex">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-indigo-500 opacity-50 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-indigo-800 opacity-50 blur-3xl" />
        <div className="relative max-w-md px-12 text-white">
          <p className="text-4xl font-extrabold leading-tight">Go Viral.<br />Effortlessly.</p>
          <p className="mt-6 text-lg text-indigo-100">
            “Viply grew my account from 2K to 180K followers in four months. I barely touch it — autopilot does the work.”
          </p>
          <p className="mt-4 font-semibold">— Maya R., fitness creator</p>
        </div>
      </div>
    </div>
  )
}
