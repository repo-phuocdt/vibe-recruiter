import type { Context, Next } from 'hono';
import type { Env, Variables } from './index';

const RATE_LIMIT_PER_MIN = 60;
const WINDOW_SECONDS = 60;

type RateLimitContext = Context<{ Bindings: Env; Variables: Variables }>;

export async function rateLimiter(c: RateLimitContext, next: Next): Promise<Response | void> {
  const rateLimitKey = c.get('userId') ?? c.get('apiKey');

  if (!rateLimitKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const kv = c.env.RATE_LIMIT;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / WINDOW_SECONDS);
  const kvKey = `rate:${rateLimitKey}:${windowKey}`;

  const raw = await kv.get(kvKey);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= RATE_LIMIT_PER_MIN) {
    const resetAt = (windowKey + 1) * WINDOW_SECONDS;
    c.header('X-RateLimit-Limit', String(RATE_LIMIT_PER_MIN));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(resetAt));
    return c.json({ error: 'Rate limit exceeded. Max 60 requests per minute.' }, 429);
  }

  await kv.put(kvKey, String(count + 1), { expirationTtl: WINDOW_SECONDS * 2 });

  c.header('X-RateLimit-Limit', String(RATE_LIMIT_PER_MIN));
  c.header('X-RateLimit-Remaining', String(RATE_LIMIT_PER_MIN - count - 1));

  // Track monthly request usage for authenticated users
  const userId = c.get('userId');
  if (userId) {
    const d = new Date();
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const usageKey = `usage:${userId}:${monthKey}:req`;
    const monthlyTtl = 35 * 86_400; // 35 days (covers month rollover)
    const prevRaw = await kv.get(usageKey);
    const prev = prevRaw ? parseInt(prevRaw, 10) : 0;
    await kv.put(usageKey, String(prev + 1), { expirationTtl: monthlyTtl });
  }

  await next();
}
