// Prices and rough cost estimates. Shared by the server (actual costs) and the browser (estimates).
// List prices for claude-sonnet-5-5 in USD. Update if Anthropic changes pricing. Your invoice is the source of truth.
export const PRICES = {
  inputPerMTok: 2,
  outputPerMTok: 10,
  cacheWritePerMTok: 2.5,
  cacheReadPerMTok: 0.2,
  webSearch: 10 / 1000, // $10 per 1,000 searches
}

// Typical size of one agent call (system prompt + briefing in, JSON out).
const CALL = { inputTokens: 8000, outputTokens: 2500 }
const callUsd = (CALL.inputTokens * PRICES.inputPerMTok + CALL.outputTokens * PRICES.outputPerMTok) / 1e6

/**
 * Rough cost of producing one Content Plan day: hooks + script + quality review + captions,
 * plus up to 3 rewrite rounds (script + review each) in the worst case.
 */
export function estimatePlanDayCost() {
  return { typical: round(callUsd * 6), max: round(callUsd * 10) }
}

/** Rough cost of the "Improve it" step (one large Creative Director call). */
export function estimateImproveCost(days) {
  return round((12000 + days * 400) * PRICES.inputPerMTok / 1e6 + (3000 + days * 350) * PRICES.outputPerMTok / 1e6)
}

const round = (n) => Math.round(n * 100) / 100
