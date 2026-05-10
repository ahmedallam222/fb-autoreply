'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'fb-autoreply-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    const errObj = data as { error?: string; details?: unknown };
    throw new ApiError(errObj.error ?? `HTTP ${res.status}`, res.status, errObj.details);
  }
  return (await res.json()) as T;
}

// Typed fetcher for SWR. The cast lets SWR's generic narrow `data` to
// whatever the caller types via `useSWR<T>(...)` without spreading `any`.
type SwrFetcher = <T = unknown>(path: string) => Promise<T>;
export const swrFetcher: SwrFetcher = ((path: string) => api(path)) as SwrFetcher;
