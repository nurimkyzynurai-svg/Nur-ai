import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { MODEL } from '../src/agents/shared.js'
import { getClient } from './claude.js'
import { addUsage, emptyUsage } from './cost.js'

const MAX_CONTINUATIONS = 2

/**
 * Step 1: research with Anthropic's web search tool.
 * Returns research notes (with [S#] markers) and the list of real sources found.
 */
async function research({ system, prompt, maxSearches, usage }) {
  const client = getClient()
  const messages = [{ role: 'user', content: prompt }]
  const blocks = []

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }],
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    addUsage(usage, res.usage)
    if (res.stop_reason === 'refusal') throw new Error('The research request was declined.')
    blocks.push(...res.content)
    // A long server-side search loop can pause; send the turn back to let it resume —
    // but never past the search budget (that is what keeps the cost capped).
    if (res.stop_reason !== 'pause_turn' || usage.webSearches >= maxSearches) break
    messages.splice(1, messages.length - 1, { role: 'assistant', content: blocks.slice() })
  }

  const sources = []
  const idFor = (url, title, pageAge) => {
    let s = sources.find((x) => x.url === url)
    if (!s) {
      s = { id: `S${sources.length + 1}`, url, title: title || '', pageAge: pageAge || '' }
      sources.push(s)
    }
    return s.id
  }

  let notes = ''
  const searchErrors = []
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result') {
      // Success: a list of results. Failure: a single error object (it does not throw).
      if (Array.isArray(b.content)) for (const r of b.content) idFor(r.url, r.title, r.page_age)
      else searchErrors.push(b.content?.error_code || 'unknown_error')
    } else if (b.type === 'text') {
      const cited = [...new Set((b.citations || []).filter((c) => c.type === 'web_search_result_location').map((c) => idFor(c.url, c.title)))]
      notes += b.text + (cited.length ? ` [${cited.join(', ')}]` : '')
    }
  }
  return { notes: notes.trim(), sources, searchErrors }
}

/** Step 2: structure the notes into the agent's JSON schema (no tools, notes only). */
async function structure({ system, prompt, schema, usage }) {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  addUsage(usage, res.usage)
  if (res.stop_reason === 'refusal') throw new Error('The structuring request was declined.')
  if (!res.parsed_output) throw new Error('The research summary came back in the wrong format.')
  return res.parsed_output
}

const HAS_NUMBER = /\d/

/**
 * Enforces the citation rules in code: drops source ids that don't exist, and marks
 * any item without a real source — or with a number and no source — as unverified.
 */
export function validateItems(items, sources) {
  const ids = new Set(sources.map((s) => s.id))
  return items.map((item) => {
    const source_ids = [...new Set(item.source_ids.filter((id) => ids.has(id)))]
    const flags = []
    if (!source_ids.length) flags.push('no source')
    if (!source_ids.length && HAS_NUMBER.test(item.detail)) flags.push('number without a source')
    return { ...item, source_ids, verified: item.verified && source_ids.length > 0, flags }
  })
}

/** Research + structure for one research agent. Returns { data, sources, usage, searchErrors }. */
export async function runResearchAgent(agent, input, { maxSearches }) {
  const usage = emptyUsage()
  const today = new Date().toISOString().slice(0, 10)
  const found = await research({
    system: agent.researchSystemPrompt,
    prompt: agent.buildResearchMessage({ ...input, today, maxSearches }),
    maxSearches,
    usage,
  })
  if (!found.sources.length) {
    throw new Error(
      found.searchErrors.length
        ? `Web search failed (${found.searchErrors.join(', ')}). Check that web search is enabled for your Anthropic organization.`
        : 'Web search returned no sources.',
    )
  }
  const data = await structure({
    system: agent.structureSystemPrompt,
    prompt: agent.buildStructureMessage({ ...input, today, notes: found.notes, sources: found.sources }),
    schema: agent.outputSchema,
    usage,
  })
  return { data, sources: found.sources, usage, searchErrors: found.searchErrors }
}
