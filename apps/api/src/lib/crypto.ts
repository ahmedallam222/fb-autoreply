import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * AES-256-GCM encryption for sensitive secrets (Page Access Tokens, etc).
 *
 * Storage format (base64url):
 *   enc:v1:<iv_b64>.<auth_tag_b64>.<ciphertext_b64>
 *
 * Why a prefix? It lets us tell at-rest plaintext from ciphertext during the
 * lazy migration window. Existing rows written before this PR look like a raw
 * token; new writes look like `enc:v1:...`. On read we detect the prefix and
 * decrypt, otherwise we treat the value as plaintext (and the caller should
 * re-encrypt it).
 */

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM-recommended IV length

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  let raw = env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and put it in your environment.',
      );
    }
    // Dev/test fallback so `npm run dev` and CI work without manual setup.
    // The key is deterministic but local-only; never use this in production.
    raw = 'dev-only-token-encryption-key-do-not-use-in-production-XXXXXXXXXX';
    logger.warn(
      'TOKEN_ENCRYPTION_KEY is not set — using a dev fallback. DO NOT deploy without setting this.',
    );
  }
  // Accept either 64 hex chars (recommended) or any string ≥ 32 chars (we'll hash it).
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else if (raw.length >= 32) {
    key = crypto.createHash('sha256').update(raw).digest();
    logger.warn(
      'TOKEN_ENCRYPTION_KEY is not 64 hex chars; SHA-256 hashing it. For production use `openssl rand -hex 32`.',
    );
  } else {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 chars (preferably 64 hex chars).');
  }
  cachedKey = key;
  return key;
}

/** Returns true iff `s` is a value previously produced by `encrypt()`. */
export function isEncrypted(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith(PREFIX);
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    iv.toString('base64url') +
    '.' +
    tag.toString('base64url') +
    '.' +
    ct.toString('base64url')
  );
}

export function decrypt(stored: string): string {
  if (!isEncrypted(stored)) {
    throw new Error('decrypt() called on non-encrypted value (missing enc:v1: prefix)');
  }
  const body = stored.slice(PREFIX.length);
  const parts = body.split('.');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [ivB, tagB, ctB] = parts;
  const iv = Buffer.from(ivB!, 'base64url');
  const tag = Buffer.from(tagB!, 'base64url');
  const ct = Buffer.from(ctB!, 'base64url');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Read a possibly-encrypted value and return the plaintext.
 * Used for the lazy-migration window: stored values written before the
 * encryption rollout are still plaintext; we transparently return them.
 */
export function readMaybeEncrypted(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored;
}
