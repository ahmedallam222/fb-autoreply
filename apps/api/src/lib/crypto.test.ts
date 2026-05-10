import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, isEncrypted, readMaybeEncrypted } from './crypto.js';

test('encrypt() produces enc:v1: prefixed ciphertext', () => {
  const ct = encrypt('hello-token');
  assert.ok(ct.startsWith('enc:v1:'));
  assert.ok(isEncrypted(ct));
});

test('decrypt(encrypt(x)) === x for ASCII', () => {
  const pt = 'EAAB-fake-page-access-token-12345';
  assert.equal(decrypt(encrypt(pt)), pt);
});

test('decrypt(encrypt(x)) === x for unicode + symbols', () => {
  const pt = 'صفحة "test" — special chars: \\n\\t};{!@#$%^&*()';
  assert.equal(decrypt(encrypt(pt)), pt);
});

test('isEncrypted is false for plaintext', () => {
  assert.equal(isEncrypted('plain-token'), false);
  assert.equal(isEncrypted(''), false);
  assert.equal(isEncrypted(null), false);
});

test('readMaybeEncrypted returns plaintext as-is', () => {
  assert.equal(readMaybeEncrypted('plain-token'), 'plain-token');
});

test('readMaybeEncrypted decrypts encrypted values', () => {
  const ct = encrypt('secret');
  assert.equal(readMaybeEncrypted(ct), 'secret');
});

test('two encryptions of the same plaintext differ (random IV)', () => {
  const a = encrypt('same');
  const b = encrypt('same');
  assert.notEqual(a, b);
  assert.equal(decrypt(a), 'same');
  assert.equal(decrypt(b), 'same');
});

test('decrypt throws on tampered ciphertext (auth tag verification)', () => {
  const ct = encrypt('important');
  // Flip a byte in the ciphertext portion (last segment after the second '.').
  const idx = ct.lastIndexOf('.');
  const before = ct.slice(0, idx + 1);
  const after = ct.slice(idx + 1);
  const flipped = after[0] === 'A' ? 'B' + after.slice(1) : 'A' + after.slice(1);
  assert.throws(() => decrypt(before + flipped));
});
