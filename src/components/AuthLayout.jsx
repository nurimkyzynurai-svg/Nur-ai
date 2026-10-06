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
          <ul className="mt-8 space-y-4 text-lg text-indigo-100">
            <li>🧬 Your Brand DNA, followed by every agent</li>
            <li>🔍 Scripts checked for quality and market fit before you see them</li>
            <li>🌐 Live market research with source links</li>
            <li>📋 Your campaign plan, executed or improved with your approval</li>
          </ul>
          <p className="mt-8 text-sm text-indigo-200">Early access: 3 free generations on your own brand. Payments aren’t switched on yet.</p>
        </div>
      </div>
    </div>
  )
}
