// Voice Setup (Brand DNA inputs) and the saved profile summary. Used by Create Content and Content Plan.

export const QUESTIONS = [
  ['tone', 'Tone', 'How should your content sound? (e.g. warm, bold, funny, calm)'],
  ['style', 'Style', 'How do you like to write and present? (short lines, stories, lists, emojis…)'],
  ['audience', 'Audience', 'Who are you talking to? What do they want?'],
  ['phrases', 'Favorite phrases', 'Words or expressions you use often'],
  ['neverDo', 'Never do', 'Topics, words or styles we must never use'],
]

export const EMPTY_BRAND = { examplePosts: ['', '', ''], answers: { tone: '', style: '', audience: '', phrases: '', neverDo: '' } }

export function VoiceSetup({ brand, setBrand }) {
  const setPost = (i, v) => setBrand({ ...brand, examplePosts: brand.examplePosts.map((p, j) => (j === i ? v : p)) })
  const setAnswer = (k, v) => setBrand({ ...brand, answers: { ...brand.answers, [k]: v } })
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700">Your 3–5 best posts</p>
        <p className="text-xs text-slate-500">Paste the text or script of posts that performed well and sound like you.</p>
        <div className="mt-2 space-y-2">
          {brand.examplePosts.map((post, i) => (
            <textarea key={i} rows={3} value={post} onChange={(e) => setPost(i, e.target.value)} placeholder={`Post ${i + 1}`} className={input} />
          ))}
        </div>
        {brand.examplePosts.length < 5 && (
          <button type="button" onClick={() => setBrand({ ...brand, examplePosts: [...brand.examplePosts, ''] })} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            + Add another post
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {QUESTIONS.map(([key, label, hint], i) => (
          <label key={key} className={key === 'neverDo' ? 'sm:col-span-2' : ''}>
            <span className="text-sm font-medium text-slate-700">{i + 1}. {label}</span>
            <input value={brand.answers[key]} onChange={(e) => setAnswer(key, e.target.value)} placeholder={hint} className={`mt-1 ${input}`} />
          </label>
        ))}
      </div>
    </div>
  )
}

export function ProfileSummary({ profile }) {
  const rows = [
    ['Tone', profile.tone],
    ['Style', profile.style],
    ['Audience', profile.audience],
    ['Favorite phrases', profile.favorite_phrases?.join(' · ')],
    ['Never do', profile.never_do?.join(' · ')],
  ]
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className={k === 'Never do' ? 'sm:col-span-2' : ''}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
          <dd className="mt-0.5 text-slate-700">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
