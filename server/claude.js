import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { MODEL } from '../src/agents/shared.js'

export const MOCK = process.env.MOCK_AI === 'true'

// The key is read from .env by the server only. It never reaches the browser.
let client
function getClient() {
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
export async function runAgent(agent, input, { signal } = {}) {
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
  const out = structuredClone(agent.exampleOutput)
  if (agent.id === 'quality' && input.attempt === 1) {
    // Fail the first draft so the Script ⇄ Quality loop is visible.
    Object.assign(out, {
      virality_score: 6,
      overall_score: 6,
      passed: false,
      issues: ['The setup is slow — viewers may swipe at second 5.'],
      feedback_for_script_agent: ['Cut the setup to one line and tease myth three immediately.'],
    })
  }
  if (agent.id === 'script' && input.feedback) out.changes_made = 'Tightened the setup and teased myth three earlier.'
  return out
}
