import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../index';
import { getJwtSecret } from '../jwt-secret';

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// PBKDF2 password hashing via Web Crypto API (CF Workers compatible)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256,
  );
  const hash = new Uint8Array(bits);
  const toHex = (arr: Uint8Array) => Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt)}:${toHex(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256,
  );
  const computed = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Constant-time comparison
  if (computed.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

async function signToken(payload: Record<string, unknown>, secret: Uint8Array, exp: string): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(secret);
}

// POST /auth/register
router.post('/register', zValidator('json', RegisterSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ error: 'Email already registered' }, 409);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, api_key, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, email, id, passwordHash, 'free', now)
    .run();

  const secret = getJwtSecret(c.env);
  const accessToken = await signToken({ sub: id, email, plan: 'free' }, secret, '1h');
  const refreshToken = await signToken({ sub: id, type: 'refresh' }, secret, '7d');
  await c.env.RATE_LIMIT.put(`refresh:${id}`, refreshToken, { expirationTtl: 7 * 86_400 });

  return c.json({ accessToken, refreshToken, user: { id, email, plan: 'free' } }, 201);
});

// POST /auth/login
router.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, plan FROM users WHERE email = ?',
  ).bind(email).first<{ id: string; email: string; password_hash: string | null; plan: string }>();

  // Return same error for missing user/wrong password to prevent enumeration
  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const secret = getJwtSecret(c.env);
  const accessToken = await signToken({ sub: user.id, email: user.email, plan: user.plan }, secret, '1h');
  const refreshToken = await signToken({ sub: user.id, type: 'refresh' }, secret, '7d');
  await c.env.RATE_LIMIT.put(`refresh:${user.id}`, refreshToken, { expirationTtl: 7 * 86_400 });

  return c.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, plan: user.plan } });
});

// POST /auth/refresh
router.post('/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));
  if (!body.refreshToken) return c.json({ error: 'Missing refresh token' }, 400);

  try {
    const secret = getJwtSecret(c.env);
    const { payload } = await jwtVerify(body.refreshToken, secret);
    if (payload['type'] !== 'refresh' || !payload.sub) return c.json({ error: 'Invalid refresh token' }, 401);

    const stored = await c.env.RATE_LIMIT.get(`refresh:${payload.sub}`);
    if (stored !== body.refreshToken) return c.json({ error: 'Refresh token revoked' }, 401);

    const user = await c.env.DB.prepare('SELECT id, email, plan FROM users WHERE id = ?')
      .bind(payload.sub)
      .first<{ id: string; email: string; plan: string }>();
    if (!user) return c.json({ error: 'User not found' }, 404);

    const newAccessToken = await signToken({ sub: user.id, email: user.email, plan: user.plan }, secret, '1h');
    return c.json({ accessToken: newAccessToken, user: { id: user.id, email: user.email, plan: user.plan } });
  } catch {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }
});

// POST /auth/logout
router.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { payload } = await jwtVerify(authHeader.slice(7), getJwtSecret(c.env));
      if (payload.sub) await c.env.RATE_LIMIT.delete(`refresh:${payload.sub}`);
    } catch { /* expired token still logs out */ }
  }
  return c.json({ success: true });
});

export { router as authRouter };
