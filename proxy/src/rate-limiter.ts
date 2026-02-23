import type { Context, Next } from 'hono';
import type { Env, Variables } from './index';

const RATE_LIMIT = 60;
const WINDOW_SECONDS = 60;

type RateLimitContext = Context<{ Bindings: Env; Variables: Variables }>;

export async function rateLimiter(c: RateLimitContext, next: Next): Promise<Response | void> {
  const apiKey = c.get('apiKey');

  if (!apiKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const kv = c.env.RATE_LIMIT;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / WINDOW_SECONDS);
  const kvKey = `rate:${apiKey}:${windowKey}`;

  const raw = await kv.get(kvKey);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= RATE_LIMIT) {
    const resetAt = (windowKey + 1) * WINDOW_SECONDS;
    c.header('X-RateLimit-Limit', String(RATE_LIMIT));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(resetAt));
    return c.json(
      { error: 'Rate limit exceeded. Max 60 requests per minute.' },
      429
    );
  }

  await kv.put(kvKey, String(count + 1), { expirationTtl: WINDOW_SECONDS * 2 });

  c.header('X-RateLimit-Limit', String(RATE_LIMIT));
  c.header('X-RateLimit-Remaining', String(RATE_LIMIT - count - 1));

  await next();
}
