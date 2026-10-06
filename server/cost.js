import { PRICES } from '../src/agents/costs.js'

export { PRICES }

export function emptyUsage() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, webSearches: 0 }
}

/** Adds one API response's `usage` object to a running total. */
export function addUsage(total, usage) {
  if (!usage) return total
  total.calls += 1
  total.inputTokens += usage.input_tokens || 0
  total.outputTokens += usage.output_tokens || 0
  total.cacheWriteTokens += usage.cache_creation_input_tokens || 0
  total.cacheReadTokens += usage.cache_read_input_tokens || 0
  total.webSearches += usage.server_tool_use?.web_search_requests || 0
  return total
}

export function costOf(u) {
  const usd =
    (u.inputTokens * PRICES.inputPerMTok +
      u.outputTokens * PRICES.outputPerMTok +
      u.cacheWriteTokens * PRICES.cacheWritePerMTok +
      u.cacheReadTokens * PRICES.cacheReadPerMTok) /
      1e6 +
    u.webSearches * PRICES.webSearch
  return Math.round(usd * 10000) / 10000
}

/**
 * Rough upper-bound estimate before a research run: each search result adds roughly
 * 8k input tokens, plus the research answer and the structuring step.
 */
export function estimateResearchCost(maxSearches) {
  return costOf({
    inputTokens: 6000 + maxSearches * 8000 + 15000,
    outputTokens: 8000 + 5000,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    webSearches: maxSearches,
  })
}
