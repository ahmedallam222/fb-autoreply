/**
 * Approximate OpenAI per-token pricing in USD.
 * Source: https://openai.com/api/pricing/ (manually maintained — update when rates change).
 *
 * Values are USD **per 1 million tokens** (matches OpenAI's pricing page format).
 */
interface ModelRate {
  inputPerMTokens: number;
  outputPerMTokens: number;
}

// Match by exact model id first; fall back to family prefix.
const RATES: Array<[RegExp, ModelRate]> = [
  [/^gpt-4o-mini/, { inputPerMTokens: 0.15, outputPerMTokens: 0.6 }],
  [/^gpt-4o/, { inputPerMTokens: 2.5, outputPerMTokens: 10.0 }],
  [/^gpt-4\.1-mini/, { inputPerMTokens: 0.4, outputPerMTokens: 1.6 }],
  [/^gpt-4\.1/, { inputPerMTokens: 2.0, outputPerMTokens: 8.0 }],
  [/^gpt-4-turbo/, { inputPerMTokens: 10.0, outputPerMTokens: 30.0 }],
  [/^gpt-4/, { inputPerMTokens: 30.0, outputPerMTokens: 60.0 }],
  [/^gpt-3\.5/, { inputPerMTokens: 0.5, outputPerMTokens: 1.5 }],
];

const FALLBACK_RATE: ModelRate = { inputPerMTokens: 0.5, outputPerMTokens: 1.5 };

export function rateForModel(model: string | null | undefined): ModelRate {
  if (!model) return FALLBACK_RATE;
  for (const [pattern, rate] of RATES) {
    if (pattern.test(model)) return rate;
  }
  return FALLBACK_RATE;
}

export function estimateCostUsd(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = rateForModel(model);
  return (
    (promptTokens / 1_000_000) * rate.inputPerMTokens +
    (completionTokens / 1_000_000) * rate.outputPerMTokens
  );
}
