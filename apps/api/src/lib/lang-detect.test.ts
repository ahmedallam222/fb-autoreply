import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { detectLanguage, languageDisplayName } from './lang-detect.js';

test('detectLanguage: empty / null / whitespace returns en', () => {
  assert.equal(detectLanguage(''), 'en');
  assert.equal(detectLanguage(null), 'en');
  assert.equal(detectLanguage(undefined), 'en');
  assert.equal(detectLanguage('   \n\t  '), 'en');
});

test('detectLanguage: pure English text', () => {
  assert.equal(detectLanguage('Hello, what is the price?'), 'en');
  assert.equal(detectLanguage('Hi there'), 'en');
});

test('detectLanguage: pure Arabic text', () => {
  assert.equal(detectLanguage('السعر كام؟'), 'ar');
  assert.equal(detectLanguage('مرحبا، عايز أعرف الأسعار'), 'ar');
});

test('detectLanguage: code-mixed (Arabizi) where Arabic dominates', () => {
  // Customer asking in Arabic with one English word — should still be 'ar'.
  assert.equal(detectLanguage('هل ده available؟'), 'ar');
  assert.equal(detectLanguage('السعر price ايه؟'), 'ar');
});

test('detectLanguage: English with a stray emoji or punctuation stays en', () => {
  assert.equal(detectLanguage('Hello! 👋'), 'en');
  assert.equal(detectLanguage('Price please?? :)'), 'en');
});

test('detectLanguage: digits/emoji/punctuation only returns en (default)', () => {
  // No letters at all — we default to en since the AI defaults to English
  // and there\'s no signal to change that.
  assert.equal(detectLanguage('123 456'), 'en');
  assert.equal(detectLanguage('👋👋👋'), 'en');
  assert.equal(detectLanguage('!!! ???'), 'en');
});

test('detectLanguage: 30% threshold lets a single Arabic word flip to ar', () => {
  // 1 Arabic word out of mostly-English — depends on the ratio.
  // "اهلا hello there friend" → 3 ar letters vs 16 latin letters = ~16% → en
  assert.equal(detectLanguage('اهلا hello there friend'), 'en');
  // "اهلا اهلا hello" → 8 ar letters vs 5 latin = 61% → ar
  assert.equal(detectLanguage('اهلا اهلا hello'), 'ar');
});

test('detectLanguage: Arabic Presentation Forms (ligatures) are detected', () => {
  // Some keyboards / older systems output ligatures from FB50..FDFF.
  // U+FB50 = ARABIC LETTER ALEF WASLA ISOLATED FORM
  assert.equal(detectLanguage('\uFB50\uFB50\uFB50'), 'ar');
});

test('languageDisplayName: human-readable label', () => {
  assert.equal(languageDisplayName('ar'), 'Arabic');
  assert.equal(languageDisplayName('en'), 'English');
});
