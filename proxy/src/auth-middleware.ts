import type { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import type { Env, Variables } from './index';
import { getJwtSecret } from './jwt-secret';

type AuthContext = Context<{ Bindings: Env; Variables: Variables }>;

/**
 * Auth middleware: accepts a valid user JWT or the shared PROXY_API_KEY.
 * JWT auth sets `userId`; API key auth sets `apiKey` only (legacy/dev mode).
 */
export async function authMiddleware(c: AuthContext, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  // Try JWT verification first
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(c.env));
    if (payload.sub && payload['type'] !== 'refresh') {
      c.set('userId', payload.sub);
      c.set('apiKey', payload.sub);
      await next();
      return;
    }
  } catch {
    // Not a valid JWT — fall through to API key check
  }

  // Fall back to shared PROXY_API_KEY (dev mode)
  const expectedKey = c.env.PROXY_API_KEY;
  if (!expectedKey) return c.json({ error: 'Server misconfiguration: PROXY_API_KEY not set' }, 500);

  const encoder = new TextEncoder();
  const a = encoder.encode(token);
  const b = encoder.encode(expectedKey);
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  c.set('apiKey', token);
  await next();
}
