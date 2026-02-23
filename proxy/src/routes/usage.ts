import { Hono } from 'hono';
import type { Env, Variables } from '../index';

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

const PLAN_LIMITS = {
  free: { requests: 1_000, tokens: 500_000 },
  pro: { requests: 10_000, tokens: 5_000_000 },
} as const;

type Plan = keyof typeof PLAN_LIMITS;

// GET /usage — returns monthly usage for the authenticated user
router.get('/', async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [reqRaw, tokRaw, userRow] = await Promise.all([
    c.env.RATE_LIMIT.get(`usage:${userId}:${monthKey}:req`),
    c.env.RATE_LIMIT.get(`usage:${userId}:${monthKey}:tok`),
    c.env.DB.prepare('SELECT plan FROM users WHERE id = ?')
      .bind(userId)
      .first<{ plan: string }>(),
  ]);

  const plan = ((userRow?.plan ?? 'free') as Plan) in PLAN_LIMITS
    ? (userRow!.plan as Plan)
    : 'free';
  const limits = PLAN_LIMITS[plan];
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return c.json({
    requestCount: reqRaw ? parseInt(reqRaw, 10) : 0,
    tokensUsed: tokRaw ? parseInt(tokRaw, 10) : 0,
    requestLimit: limits.requests,
    tokenLimit: limits.tokens,
    plan,
    resetDate,
  });
});

export { router as usageRouter };
