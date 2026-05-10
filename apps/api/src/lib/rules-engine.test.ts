import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { findMatchingRule, renderTemplate, type RuleCandidate } from './rules-engine.js';

const baseRule: RuleCandidate = {
  id: 'r1',
  enabled: true,
  channel: 'BOTH',
  matchType: 'CONTAINS',
  keywords: ['price'],
  caseSensitive: false,
  responseTemplate: 'Pricing info: example.com',
  priority: 0,
  alsoDmOnComment: false,
};

test('renderTemplate replaces variables and tolerates whitespace', () => {
  assert.equal(renderTemplate('Hi {{name}}', { name: 'Ahmed' }), 'Hi Ahmed');
  assert.equal(renderTemplate('Hi {{ first_name }}', { first_name: 'Ahmed' }), 'Hi Ahmed');
  assert.equal(renderTemplate('Hi {{missing}}', {}), 'Hi ');
});

test('CONTAINS matches case-insensitively by default', () => {
  const r = findMatchingRule({
    text: 'What is the PRICE?',
    channel: 'COMMENT',
    rules: [baseRule],
  });
  assert.ok(r);
  assert.equal(r!.matchedKeyword, 'price');
});

test('EXACT requires full equality after trim', () => {
  const r = findMatchingRule({
    text: 'price ',
    channel: 'COMMENT',
    rules: [{ ...baseRule, matchType: 'EXACT' }],
  });
  assert.ok(r);
});

test('STARTS_WITH only matches at the beginning', () => {
  const rules: RuleCandidate[] = [{ ...baseRule, matchType: 'STARTS_WITH' }];
  assert.ok(findMatchingRule({ text: 'price me', channel: 'COMMENT', rules }));
  assert.equal(findMatchingRule({ text: 'tell me price', channel: 'COMMENT', rules }), null);
});

test('REGEX uses a regular expression', () => {
  const rules: RuleCandidate[] = [
    { ...baseRule, matchType: 'REGEX', keywords: ['^how (much|many)'] },
  ];
  assert.ok(findMatchingRule({ text: 'how much is it', channel: 'COMMENT', rules }));
  assert.equal(findMatchingRule({ text: 'where is it', channel: 'COMMENT', rules }), null);
});

test('Channel filtering excludes wrong-channel rules', () => {
  const rules: RuleCandidate[] = [{ ...baseRule, channel: 'MESSAGE' }];
  assert.equal(findMatchingRule({ text: 'price', channel: 'COMMENT', rules }), null);
  assert.ok(findMatchingRule({ text: 'price', channel: 'MESSAGE', rules }));
});

test('Higher priority wins when multiple rules match', () => {
  const low: RuleCandidate = { ...baseRule, id: 'low', priority: 1, responseTemplate: 'low' };
  const high: RuleCandidate = { ...baseRule, id: 'high', priority: 10, responseTemplate: 'high' };
  const r = findMatchingRule({ text: 'price', channel: 'COMMENT', rules: [low, high] });
  assert.equal(r?.rule.id, 'high');
});

test('Disabled rules are skipped', () => {
  const r = findMatchingRule({
    text: 'price',
    channel: 'COMMENT',
    rules: [{ ...baseRule, enabled: false }],
  });
  assert.equal(r, null);
});

test('Variables are substituted into the rendered template', () => {
  const r = findMatchingRule({
    text: 'price please',
    channel: 'COMMENT',
    rules: [{ ...baseRule, responseTemplate: 'Hi {{first_name}}, see prices.' }],
    variables: { first_name: 'Ahmed' },
  });
  assert.equal(r?.rendered, 'Hi Ahmed, see prices.');
});

test('Match exposes the rule\'s alsoDmOnComment flag so the pipeline can act on it', () => {
  const dmRule: RuleCandidate = { ...baseRule, id: 'dm', alsoDmOnComment: true };
  const r = findMatchingRule({ text: 'price', channel: 'COMMENT', rules: [dmRule] });
  assert.equal(r?.rule.alsoDmOnComment, true);

  const noDmRule: RuleCandidate = { ...baseRule, id: 'no-dm', alsoDmOnComment: false };
  const r2 = findMatchingRule({ text: 'price', channel: 'COMMENT', rules: [noDmRule] });
  assert.equal(r2?.rule.alsoDmOnComment, false);
});

test('Arabic keyword match works', () => {
  const r = findMatchingRule({
    text: 'السعر كام؟',
    channel: 'COMMENT',
    rules: [{ ...baseRule, keywords: ['سعر'] }],
  });
  assert.ok(r);
});
