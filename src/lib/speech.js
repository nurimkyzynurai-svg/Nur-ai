// Browser speech-to-text (Web Speech API). Viply never receives audio — only the text the browser produces.

export const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined
export const speechSupported = Boolean(SpeechRecognition)

// Recognition languages offered in the dropdown (content languages first).
export const VOICE_LANGUAGES = [
  ['en-US', 'English'],
  ['ru-RU', 'Русский'],
  ['kk-KZ', 'Қазақша'],
  ['es-ES', 'Español'],
  ['tr-TR', 'Türkçe'],
  ['uz-UZ', 'Oʻzbekcha'],
  ['de-DE', 'Deutsch'],
  ['fr-FR', 'Français'],
  ['pt-BR', 'Português'],
  ['ar-SA', 'العربية'],
  ['uk-UA', 'Українська'],
  ['ky-KG', 'Кыргызча'],
  ['it-IT', 'Italiano'],
  ['pl-PL', 'Polski'],
  ['zh-CN', '中文'],
  ['hi-IN', 'हिन्दी'],
]

const BY_NAME = {
  english: 'en-US',
  russian: 'ru-RU',
  kazakh: 'kk-KZ',
  spanish: 'es-ES',
  turkish: 'tr-TR',
  uzbek: 'uz-UZ',
  german: 'de-DE',
  french: 'fr-FR',
  portuguese: 'pt-BR',
  arabic: 'ar-SA',
  ukrainian: 'uk-UA',
  kyrgyz: 'ky-KG',
  italian: 'it-IT',
  polish: 'pl-PL',
  chinese: 'zh-CN',
  hindi: 'hi-IN',
}

/** Maps a content language name ("Russian", "Kazakh", or anything typed) to a recognition code. */
export function speechLangFor(contentLanguage) {
  const key = String(contentLanguage || '').trim().toLowerCase()
  if (BY_NAME[key]) return BY_NAME[key]
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return VOICE_LANGUAGES.some(([code]) => code === nav) ? nav : 'en-US'
}

// The user can pick a recognition language different from the content language; the choice is shared by all fields.
const OVERRIDE_KEY = 'viply_voice_lang'
export function getVoiceOverride() {
  try {
    return localStorage.getItem(OVERRIDE_KEY) || ''
  } catch {
    return ''
  }
}
export function setVoiceOverride(code) {
  try {
    if (code) localStorage.setItem(OVERRIDE_KEY, code)
    else localStorage.removeItem(OVERRIDE_KEY)
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new Event('viply:voice-lang'))
}

/** Joins existing text and new dictated text with a single space. */
export function joinText(base, addition) {
  if (!addition) return base
  if (!base) return addition
  return /\s$/.test(base) ? base + addition : `${base} ${addition}`
}
