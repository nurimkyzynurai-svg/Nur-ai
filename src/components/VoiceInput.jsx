import { useEffect, useRef, useState } from 'react'
import { getVoiceOverride, joinText, setVoiceOverride, SpeechRecognition, speechLangFor, speechSupported, VOICE_LANGUAGES } from '../lib/speech.js'

// Only one field can listen at a time; starting a new one stops the previous one.
let stopActive = null
// Without browser support, only the first voice field on a page shows the hint (not every field).
let hintOwner = null

const ERRORS = {
  'not-allowed':
    'Microphone access is blocked. To allow it, click the lock icon next to the web address → Microphone → Allow, then try again. On iPhone or iPad: Settings → Safari → Microphone.',
  'service-not-allowed':
    'Your browser blocked voice input. Allow the microphone for this site (lock icon next to the address). In Safari, also make sure Dictation is turned on in system settings.',
  'audio-capture': 'No microphone was found. Check that one is connected and not used by another app.',
  'no-speech': 'Didn’t hear anything — click the mic and try again, a little closer to the microphone.',
  network: 'Voice input needs an internet connection in this browser. Check your connection and try again.',
  'language-not-supported': 'This browser can’t recognize the selected language. Pick another one in the language list.',
}

const PRIVACY =
  'Voice input: your browser turns your speech into text (it may use its own speech service). Viply never receives audio — only the text.'

/**
 * Mic button + recognition-language picker for a text field.
 * Dictated text is appended live to `value` through `onChange`; the user can edit it afterwards.
 */
export default function VoiceInput({ value, onChange, language, maxLength, className = '' }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const [override, setOverride] = useState(getVoiceOverride)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const recRef = useRef(null)
  const wantRef = useRef(false) // user wants to keep listening (browsers sometimes end the session on silence)
  const restartsRef = useRef(0)
  valueRef.current = value
  onChangeRef.current = onChange // always use the latest handler, even mid-dictation

  const lang = override || speechLangFor(language)
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    if (speechSupported) return
    const me = {}
    if (!hintOwner) {
      hintOwner = me
      setShowHint(true)
    }
    return () => {
      if (hintOwner === me) hintOwner = null
    }
  }, [])

  useEffect(() => {
    const sync = () => setOverride(getVoiceOverride())
    window.addEventListener('viply:voice-lang', sync)
    return () => {
      window.removeEventListener('viply:voice-lang', sync)
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stop() {
    wantRef.current = false
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
    if (stopActive === stop) stopActive = null
  }

  function startSession(code) {
    const rec = new SpeechRecognition()
    rec.lang = code
    rec.continuous = true
    rec.interimResults = true
    const base = valueRef.current || ''
    let finals = ''

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim()
        if (e.results[i].isFinal) finals = joinText(finals, text)
        else interim = joinText(interim, text)
      }
      let next = joinText(base, joinText(finals, interim))
      if (maxLength) next = next.slice(0, maxLength)
      onChangeRef.current(next)
    }
    rec.onerror = (e) => {
      if (e.error === 'aborted') return
      setError(ERRORS[e.error] || 'Voice input stopped unexpectedly. Please try again.')
      wantRef.current = false
    }
    rec.onend = () => {
      // Keep listening across the browser's automatic pauses, until the user clicks stop.
      if (wantRef.current && recRef.current === rec && restartsRef.current < 30) {
        restartsRef.current++
        try {
          startSession(code)
          return
        } catch {
          // fall through and stop
        }
      }
      if (recRef.current === rec) stop()
    }
    recRef.current = rec
    rec.start()
  }

  function start(code = lang) {
    if (stopActive && stopActive !== stop) stopActive()
    setError('')
    wantRef.current = true
    restartsRef.current = 0
    try {
      startSession(code)
      stopActive = stop
      setListening(true)
    } catch {
      wantRef.current = false
      setError('Voice input couldn’t start. Please try again.')
    }
  }

  function changeLanguage(code) {
    setVoiceOverride(code)
    setOverride(code)
    if (listening) {
      // Restart with the new language, keeping what was already dictated.
      wantRef.current = false
      recRef.current?.abort()
      recRef.current = null
      start(code || speechLangFor(language))
    }
  }

  if (!speechSupported) {
    if (!showHint) return null
    return <p className={`mt-1 text-right text-[11px] text-slate-400 ${className}`}>Voice input works in Chrome, Edge and Safari.</p>
  }

  return (
    <div className={`mt-1.5 ${className}`}>
      <div className="flex items-center justify-end gap-2">
        {listening && (
          <span className="mr-auto inline-flex items-center gap-2 text-xs font-medium text-ink" role="status" aria-live="polite">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
            </span>
            Listening… speak now
          </span>
        )}
        <select
          value={override}
          onChange={(e) => changeLanguage(e.target.value)}
          aria-label="Voice input language"
          title="Voice input language"
          className="h-8 max-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-1.5 text-xs text-slate-600 outline-none focus:border-ink"
        >
          <option value="">Auto · {VOICE_LANGUAGES.find(([c]) => c === speechLangFor(language))?.[1] || speechLangFor(language)}</option>
          {VOICE_LANGUAGES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => (listening ? stop() : start())}
          aria-pressed={listening}
          title={listening ? 'Stop voice input' : PRIVACY}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
            listening ? 'border-gold bg-gold text-ink shadow-sm shadow-gold/40' : 'border-ink/20 bg-white text-ink hover:border-ink/50'
          }`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {listening ? (
              <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
            ) : (
              <>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </>
            )}
          </svg>
          {listening ? 'Stop' : 'Dictate'}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
