import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string; // user id
  tid: string; // tenant id
  role: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: JwtPayload;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  try {
    req.auth = verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Middleware factory that requires the caller to have one of the given roles.
 * Always combine with requireAuth (this middleware reads req.auth).
 */
export function requireRole(...allowed: Role[]) {
  return function roleGate(req: Request, res: Response, next: NextFunction): void {
    if (!req.auth) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!allowed.includes(req.auth.role as Role)) {
      res.status(403).json({ error: 'forbidden', requiredRoles: allowed });
      return;
    }
    next();
  };
}
