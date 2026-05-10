import type { EventChannel } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { findMatchingRule } from '../lib/rules-engine.js';
import { generateAiReply } from '../lib/openai-client.js';
import { replyToComment, sendMessengerMessage, GraphApiError } from '../lib/facebook.js';

export interface InboundEvent {
  tenantId: string;
  pageDbId: string;
  pageAccessToken: string;
  channel: EventChannel; // 'COMMENT' | 'MESSAGE'
  text: string;
  externalId: string; // comment_id for comments, PSID for messages
  customerName?: string;
  customerHandle?: string;
}

export type AutoReplyOutcome =
  | { kind: 'replied'; source: 'RULE' | 'AI'; reply: string; fbMessageId?: string }
  | { kind: 'skipped'; reason: 'self_event' | 'empty_text' | 'no_match_no_ai' }
  | { kind: 'error'; reason: string };

/**
 * Process a single inbound event end-to-end:
 * 1. upsert Conversation
 * 2. log the inbound ReplyEvent
 * 3. try rule match → AI fallback (if enabled)
 * 4. POST reply via Graph API
 * 5. log the outbound ReplyEvent
 */
export async function processInboundEvent(event: InboundEvent): Promise<AutoReplyOutcome> {
  const text = event.text?.trim() ?? '';
  if (!text) return { kind: 'skipped', reason: 'empty_text' };

  const conversation = await prisma.conversation.upsert({
    where: {
      pageId_externalId: { pageId: event.pageDbId, externalId: event.externalId },
    },
    create: {
      tenantId: event.tenantId,
      pageId: event.pageDbId,
      channel: event.channel,
      externalId: event.externalId,
      customerName: event.customerName,
      customerHandle: event.customerHandle,
      lastMessageAt: new Date(),
    },
    update: {
      lastMessageAt: new Date(),
      customerName: event.customerName ?? undefined,
    },
  });

  await prisma.replyEvent.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      source: 'NONE',
      inboundText: text,
    },
  });

  const rules = await prisma.rule.findMany({
    where: { tenantId: event.tenantId, enabled: true },
    orderBy: { priority: 'desc' },
  });

  const match = findMatchingRule({
    text,
    channel: event.channel,
    rules,
    variables: {
      name: event.customerName ?? '',
      first_name: event.customerName?.split(' ')[0] ?? '',
    },
  });

  let replyText: string | null = null;
  let source: 'RULE' | 'AI' | null = null;
  let matchedRuleId: string | null = null;
  let aiUsage: { model: string; promptTokens: number; completionTokens: number } | null = null;

  if (match) {
    replyText = match.rendered;
    source = 'RULE';
    matchedRuleId = match.rule.id;
  } else {
    const aiCfg = await prisma.aiConfig.findUnique({ where: { tenantId: event.tenantId } });
    if (aiCfg?.enabled) {
      const ai = await generateAiReply({
        systemPrompt: aiCfg.systemPrompt,
        userMessage: text,
        model: aiCfg.model,
        maxTokens: aiCfg.maxTokens,
        temperature: aiCfg.temperature,
      });
      if (ai) {
        replyText = ai.text;
        source = 'AI';
        aiUsage = { model: ai.model, promptTokens: ai.promptTokens, completionTokens: ai.completionTokens };
      }
    }
  }

  if (!replyText || !source) {
    return { kind: 'skipped', reason: 'no_match_no_ai' };
  }

  try {
    let fbMessageId: string | undefined;
    if (event.channel === 'COMMENT') {
      const r = await replyToComment(event.externalId, replyText, event.pageAccessToken);
      fbMessageId = r.id;
    } else {
      const r = await sendMessengerMessage(event.externalId, replyText, event.pageAccessToken);
      fbMessageId = r.message_id;
    }

    await prisma.replyEvent.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        source,
        outboundText: replyText,
        matchedRuleId,
        fbMessageId,
        aiModel: aiUsage?.model,
        aiPromptTokens: aiUsage?.promptTokens,
        aiCompletionTokens: aiUsage?.completionTokens,
      },
    });

    return { kind: 'replied', source, reply: replyText, fbMessageId };
  } catch (err) {
    const msg = err instanceof GraphApiError ? err.message : (err as Error).message;
    logger.warn({ err: msg, channel: event.channel }, 'graph_reply_failed');
    await prisma.replyEvent.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        source,
        outboundText: replyText,
        matchedRuleId,
        errorMessage: msg,
        aiModel: aiUsage?.model,
        aiPromptTokens: aiUsage?.promptTokens,
        aiCompletionTokens: aiUsage?.completionTokens,
      },
    });
    return { kind: 'error', reason: msg };
  }
}
