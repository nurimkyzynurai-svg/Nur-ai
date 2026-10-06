import { BANNED_CLICHES } from '../src/agents/shared.js'

// Rule checks the server runs on every draft, on top of the Quality Agent's review.
// A model can miss a cliché or forget the keyword; code can't.

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')

const hasWord = (text, word) => {
  const escaped = normalize(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text)
}

function scriptText(script) {
  return [script.title, script.full_voiceover, ...script.beats.flatMap((b) => [b.voiceover, b.on_screen_text])].join(' \n ')
}

/** Returns feedback items (same shape as the Quality Agent's) for every rule the draft breaks. */
export function checkScript({ script, goal, previousFeedback = [] }) {
  const items = []
  const add = (quote, problem, fix) => items.push({ id: `AUTO-${items.length + 1}`, quote, problem, fix })
  const text = normalize(scriptText(script))

  for (const cliche of BANNED_CLICHES) {
    if (text.includes(normalize(cliche))) {
      add(cliche, `Banned cliché “${cliche}” — it sounds like any generic ad.`, 'Replace it with a concrete detail the viewer can see or check.')
    }
  }

  if (goal === 'business') {
    const keyword = (script.cta_keyword || '').trim()
    const cta = script.beats.filter((b) => b.section === 'cta')
    const ctaText = normalize(cta.map((b) => `${b.voiceover} ${b.on_screen_text}`).join(' '))
    if (!cta.length) {
      add('', 'There is no call-to-action beat.', 'End with a "cta" beat that says exactly what to write, e.g. «Напишите слово [КЛЮЧ] в директ».')
    } else if (!keyword) {
      add(cta[0].voiceover, 'The call to action has no keyword (cta_keyword is empty).', 'Tell viewers exactly what to write, with one keyword in capitals, and put it in cta_keyword.')
    } else if (!hasWord(ctaText, keyword)) {
      add(cta[0].voiceover, `The keyword “${keyword}” is not said or shown in the call to action.`, `Say the keyword “${keyword}” in the cta beat, e.g. «Напишите слово ${keyword} в директ».`)
    }
  }

  const fixedIds = new Set((script.fixes || []).map((f) => f.feedback_id))
  const missing = previousFeedback.map((f) => f.id).filter((id) => !fixedIds.has(id))
  if (missing.length) {
    add('', `The rewrite did not list a fix for feedback ${missing.join(', ')}.`, `Fix ${missing.join(', ')} and list each one in "fixes".`)
  }

  return items
}
