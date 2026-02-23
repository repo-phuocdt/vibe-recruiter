import type { Context, Next } from 'hono';
import type { Env, Variables } from './index';

type AuthContext = Context<{ Bindings: Env; Variables: Variables }>;

export async function authMiddleware(c: AuthContext, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const expectedKey = c.env.PROXY_API_KEY;

  if (!expectedKey) {
    return c.json({ error: 'Server misconfiguration: PROXY_API_KEY not set' }, 500);
  }

  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(token);
  const b = encoder.encode(expectedKey);
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  c.set('apiKey', token);

  await next();
}
