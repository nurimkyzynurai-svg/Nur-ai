/**
 * POSTs JSON to a Viply API route that streams newline-delimited JSON events,
 * calling onEvent for each one. Throws a readable Error on failure.
 */
export async function postStream(url, body, { onEvent, signal }) {
  let res
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('Cannot reach the Viply server. Is it running? (npm run dev)')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Server error (${res.status})`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line))
  }
}
