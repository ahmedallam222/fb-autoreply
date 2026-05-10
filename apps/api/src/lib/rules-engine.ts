import type { Rule, RuleChannel, RuleMatchType } from '@prisma/client';

export type RuleCandidate = Pick<
  Rule,
  | 'id'
  | 'enabled'
  | 'channel'
  | 'matchType'
  | 'keywords'
  | 'caseSensitive'
  | 'responseTemplate'
  | 'priority'
>;

export interface RuleMatchResult {
  rule: RuleCandidate;
  matchedKeyword: string;
  rendered: string;
}

interface MatchInput {
  text: string;
  channel: 'COMMENT' | 'MESSAGE';
  rules: RuleCandidate[];
  variables?: Record<string, string>;
}

/**
 * Find the highest-priority rule that matches the inbound text.
 * Returns null if nothing matches.
 *
 * Selection: enabled & channel-compatible rules sorted by priority desc.
 * Within the same priority we keep the first match order from the input list.
 */
export function findMatchingRule(input: MatchInput): RuleMatchResult | null {
  const eligible = input.rules
    .filter((r) => r.enabled && channelMatches(r.channel, input.channel))
    .sort((a, b) => b.priority - a.priority);

  for (const rule of eligible) {
    const matched = matchKeywords(input.text, rule);
    if (matched) {
      return {
        rule,
        matchedKeyword: matched,
        rendered: renderTemplate(rule.responseTemplate, input.variables ?? {}),
      };
    }
  }
  return null;
}

function channelMatches(ruleChannel: RuleChannel, eventChannel: 'COMMENT' | 'MESSAGE'): boolean {
  if (ruleChannel === 'BOTH') return true;
  return ruleChannel === eventChannel;
}

function matchKeywords(text: string, rule: RuleCandidate): string | null {
  const haystack = rule.caseSensitive ? text : text.toLowerCase();
  for (const raw of rule.keywords) {
    const needle = rule.caseSensitive ? raw : raw.toLowerCase();
    if (testMatch(haystack, needle, rule.matchType)) return raw;
  }
  return null;
}

function testMatch(haystack: string, needle: string, type: RuleMatchType): boolean {
  switch (type) {
    case 'EXACT':
      return haystack.trim() === needle.trim();
    case 'CONTAINS':
      return haystack.includes(needle);
    case 'STARTS_WITH':
      return haystack.trimStart().startsWith(needle);
    case 'REGEX':
      try {
        return new RegExp(needle).test(haystack);
      } catch {
        return false;
      }
  }
}

/**
 * Render a template like "Hello {{name}}, thanks for reaching out!"
 * Unknown variables are left empty. Whitespace inside braces is tolerated.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? '';
  });
}
