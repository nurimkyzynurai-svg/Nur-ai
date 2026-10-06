import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { MODEL } from '../src/agents/shared.js'

export const MOCK = ['true', 'needs-review'].includes(process.env.MOCK_AI)
const MOCK_ALWAYS_FAIL = process.env.MOCK_AI === 'needs-review'

// The key is read from .env by the server only. It never reaches the browser.
let client
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is missing. Put your key in the .env file and restart the server.')
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

export function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'Your Anthropic API key is invalid. Check ANTHROPIC_API_KEY in the .env file.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to the model.'
  if (err instanceof Anthropic.RateLimitError) return 'Too many requests to Claude right now. Wait a minute and try again.'
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your internet connection.'
  if (err instanceof Anthropic.APIError) return `Anthropic API error (${err.status}): ${err.message}`
  return err?.message || 'Unknown error'
}

/**
 * Runs one agent: its system prompt + a user message built from `input`,
 * with the reply constrained to the agent's JSON schema.
 */
export async function runAgent(agent, input, { signal, onUsage } = {}) {
  if (MOCK) return mockRun(agent, input, signal)

  const message = await getClient().beta.messages.parse(
    {
      model: MODEL,
      max_tokens: 16000,
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: agent.buildUserMessage(input) }],
      output_config: { effort: agent.effort, format: betaZodOutputFormat(agent.outputSchema) },
      // If a safety classifier declines, Anthropic retries on a recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    },
    { signal },
  )
  onUsage?.(message.usage)

  if (message.stop_reason === 'refusal') {
    throw new Error(`${agent.name} declined this request. Try rephrasing the niche.`)
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`${agent.name} ran out of space before finishing. Try again.`)
  }
  if (!message.parsed_output) {
    throw new Error(`${agent.name} returned an answer in the wrong format. Try again.`)
  }
  return message.parsed_output
}

// MOCK_AI=true: returns each agent's example output so the app can be tried without an API key.
async function mockRun(agent, input, signal) {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 700)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new Error('aborted'))
    })
  })
  if (agent.id === 'planImprover') return mockImprove(input)
  const niche = input.niche || 'your niche'
  const out = JSON.parse(JSON.stringify(agent.exampleOutput).replaceAll('{niche}', niche.replace(/["\\]/g, '')))
  if (agent.id === 'quality' && (input.attempt === 1 || MOCK_ALWAYS_FAIL)) {
    // Fail the draft so the Script ⇄ Quality loop (and "needs review") is visible.
    Object.assign(out, {
      virality_score: 7,
      overall_score: 7,
      passed: false,
      feedback: [
        { id: 'F1', quote: '', problem: '[Sample] The setup is slow — viewers may swipe at second 5.', fix: 'Cut the setup to one line and tease the strongest point immediately.' },
        { id: 'F2', quote: '', problem: '[Sample] No concrete proof in the body.', fix: 'Show the concrete result on camera instead of describing it.' },
      ],
      previous_feedback_check: (input.previousFeedback || []).map((f) => ({ id: f.id, fixed: true, note: 'Fixed' })),
    })
  }
  if (agent.id === 'script' && input.feedback?.length) {
    out.fixes = input.feedback.map((f) => ({ feedback_id: f.id, what_changed: `Fixed: ${f.fix}` }))
  }
  return out
}

// Sample "Improve it": keeps the client's days, sharpens the first unlocked one, adds a teaser before the key date.
function mockImprove({ plan }) {
  const days = plan.days.map((d, i) => ({
    date: d.date,
    content: !d.locked && i === 0 ? `[Sample improvement] ${d.content}` : d.content,
    format: d.format || 'Reel',
    platform: d.platform,
    phase: d.date < plan.keyDate ? 'teaser' : d.date === plan.keyDate ? 'main moment' : 'follow-up',
    change: !d.locked && i === 0 ? 'improved' : 'kept',
    original_date: '',
    reason: !d.locked && i === 0 ? '[Sample] Sharper opening angle.' : '[Sample] Already strong.',
  }))
  const before = new Date(`${plan.keyDate}T00:00:00Z`)
  before.setUTCDate(before.getUTCDate() - 1)
  const teaser = before.toISOString().slice(0, 10)
  if (teaser >= plan.startDate && !days.some((d) => d.date === teaser)) {
    days.push({ date: teaser, content: '[Sample] Teaser: a countdown that hints at what is coming tomorrow.', format: 'Story', platform: '', phase: 'teaser', change: 'new', original_date: '', reason: '[Sample] Builds anticipation right before the key date.' })
  }
  return {
    strategy_summary: '[Sample] Placeholder strategy: warm up, tease, deliver the main moment, then follow up.',
    phases: [{ name: 'teaser', start_date: plan.startDate, end_date: plan.keyDate, purpose: '[Sample] Build anticipation.' }],
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
    removed: [],
  }
}
