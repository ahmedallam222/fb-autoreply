import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from './auth.js';

function makeReq(role: string | null): Request {
  return {
    auth: role ? { sub: 'u1', tid: 't1', role } : undefined,
  } as unknown as Request;
}

function makeRes() {
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

test('requireRole: 401 if request is unauthenticated', () => {
  const gate = requireRole('OWNER');
  const req = makeReq(null);
  const r = makeRes();
  let nextCalled = false;
  gate(req, r.res, (() => {
    nextCalled = true;
  }) as NextFunction);
  assert.equal(r.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('requireRole: 403 if user does not have an allowed role', () => {
  const gate = requireRole('OWNER');
  const req = makeReq('MEMBER');
  const r = makeRes();
  let nextCalled = false;
  gate(req, r.res, (() => {
    nextCalled = true;
  }) as NextFunction);
  assert.equal(r.statusCode, 403);
  assert.equal(nextCalled, false);
  assert.deepEqual(r.body, { error: 'forbidden', requiredRoles: ['OWNER'] });
});

test('requireRole: passes through when role is allowed', () => {
  const gate = requireRole('OWNER', 'ADMIN');
  const req = makeReq('ADMIN');
  const r = makeRes();
  let nextCalled = false;
  gate(req, r.res, (() => {
    nextCalled = true;
  }) as NextFunction);
  assert.equal(nextCalled, true);
  assert.equal(r.statusCode, 200);
});

test('requireRole: OWNER passes when only ADMIN is allowed (negative case)', () => {
  // Sanity check that we don't auto-allow OWNER everywhere — the gate
  // checks the literal allowed list.
  const gate = requireRole('ADMIN');
  const req = makeReq('OWNER');
  const r = makeRes();
  let nextCalled = false;
  gate(req, r.res, (() => {
    nextCalled = true;
  }) as NextFunction);
  // OWNER is NOT in the allowed list, so this should be 403.
  assert.equal(r.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('requireRole: works with a single-element array', () => {
  const gate = requireRole('MEMBER');
  const req = makeReq('MEMBER');
  const r = makeRes();
  let nextCalled = false;
  gate(req, r.res, (() => {
    nextCalled = true;
  }) as NextFunction);
  assert.equal(nextCalled, true);
});
