import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let cached: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  cached ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return cached;
}

export interface AiReplyParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export async function generateAiReply(params: AiReplyParams): Promise<string | null> {
  const client = getClient();
  if (!client) {
    logger.debug('openai_disabled_no_key');
    return null;
  }
  try {
    const completion = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    logger.warn({ err }, 'openai_request_failed');
    return null;
  }
}
