import { z } from 'zod';

export const ruleMatchTypeSchema = z.enum(['exact', 'contains', 'starts_with', 'regex']);

export const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Rule name is required').max(100),
  enabled: z.boolean().default(true),
  channel: z.enum(['comment', 'message', 'both']).default('both'),
  matchType: ruleMatchTypeSchema.default('contains'),
  keywords: z.array(z.string().min(1)).min(1, 'At least one keyword is required'),
  caseSensitive: z.boolean().default(false),
  responseTemplate: z.string().min(1, 'Response template is required').max(2000),
  priority: z.number().int().min(0).default(0),
  cooldownSeconds: z.number().int().min(0).default(0),
  // When true and the rule fires on a COMMENT, also send the same text
  // as a private Messenger reply. No-op for MESSAGE-channel matches.
  alsoDmOnComment: z.boolean().default(false),
});

export type RuleInput = z.infer<typeof ruleSchema>;

export const aiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['openai']).default('openai'),
  model: z.string().default('gpt-4o-mini'),
  systemPrompt: z.string().max(4000).default(
    'You are a helpful customer support assistant for a Facebook page. Reply concisely (max 2 sentences) in the same language as the customer.',
  ),
  maxTokens: z.number().int().min(50).max(2000).default(300),
  temperature: z.number().min(0).max(2).default(0.7),
  fallbackOnly: z.boolean().default(true),
  // Same idea as Rule.alsoDmOnComment, but for AI fallback replies.
  alsoDmOnComment: z.boolean().default(false),
});

export type AiConfigInput = z.infer<typeof aiConfigSchema>;

export const pageConnectInputSchema = z.object({
  pageId: z.string().min(1),
  pageName: z.string().min(1),
  pageAccessToken: z.string().min(1),
});

export type PageConnectInput = z.infer<typeof pageConnectInputSchema>;
