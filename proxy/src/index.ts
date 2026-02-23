import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { authMiddleware } from './auth-middleware';
import { rateLimiter } from './rate-limiter';

export interface Env {
  RATE_LIMIT: KVNamespace;
  DB: D1Database;
  PROXY_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
}

export type Variables = {
  apiKey: string;
};

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS middleware
app.use(
  '*',
  cors({
    origin: ['tauri://localhost', 'http://localhost:1420'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok', environment: c.env.ENVIRONMENT });
});

// Protected routes
app.use('/v1/*', authMiddleware);
app.use('/v1/*', rateLimiter);

// Chat completions proxy
app.post('/v1/chat/completions', async (c) => {
  let body: Record<string, unknown>;

  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const model = typeof body.model === 'string' ? body.model : '';

  if (model.toLowerCase().includes('claude')) {
    return proxyToAnthropic(c, body);
  }

  return proxyToOpenAI(c, body);
});

// Forward to OpenAI
async function proxyToOpenAI(
  c: AppContext,
  body: Record<string, unknown>
): Promise<Response> {
  if (!c.env.OPENAI_API_KEY) {
    return c.json({ error: 'OPENAI_API_KEY not configured' }, 500);
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  return streamOrJson(upstream);
}

// Forward to Anthropic (transform OpenAI format → Anthropic messages format)
async function proxyToAnthropic(
  c: AppContext,
  body: Record<string, unknown>
): Promise<Response> {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  const messages = Array.isArray(body.messages)
    ? (body.messages as Array<{ role: string; content: string }>)
    : [];

  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const anthropicBody: Record<string, unknown> = {
    model: body.model ?? 'claude-3-5-sonnet-20241022',
    max_tokens: body.max_tokens ?? 8096,
    messages: userMessages,
    stream: body.stream ?? false,
  };

  if (systemMsg) {
    anthropicBody.system = systemMsg.content;
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(anthropicBody),
  });

  return streamOrJson(upstream);
}

// Pass through streaming or JSON responses
function streamOrJson(upstream: Response): Response {
  const contentType = upstream.headers.get('content-type') ?? '';
  const isStream =
    contentType.includes('text/event-stream') ||
    upstream.headers.get('transfer-encoding') === 'chunked';

  if (isStream && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default app;
