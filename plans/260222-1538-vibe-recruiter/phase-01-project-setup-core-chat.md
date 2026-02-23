# Phase 1: Project Setup & Core Chat

## Context Links
- [Plan](./plan.md) | [Brainstorm](../reports/brainstorm-260222-1538-vibe-recruiter-architecture.md)
- [Tauri v2 Guide](https://v2.tauri.app/start/create-project/) | [AI SDK Svelte](https://ai-sdk.dev/docs/getting-started/svelte) | [shadcn-svelte](https://www.shadcn-svelte.com/)

## Overview
**P1 | Complete | 3 weeks** -- Scaffold Tauri v2 + SvelteKit, build Claude-style chat UI, CF Workers proxy cho LLM API, conversation CRUD via Rust + SQLite.

## Requirements

### Functional
- Chat interface streaming responses (multi-provider: OpenAI, Claude)
- Conversation CRUD: tao, list, rename, delete conversations
- Message persistence trong SQLite
- Sidebar hien thi conversation list
- Settings page: chon model, theme (light/dark)
- CF Workers proxy server authenticate requests va forward to LLM APIs

### Non-Functional
- First token response < 2s
- App startup < 3s
- SPA mode (adapter-static), no SSR

## Related Code Files

### Frontend (SvelteKit)
```
src/lib/components/chat/chat-panel.svelte        # Main chat container
src/lib/components/chat/message-list.svelte       # Scrollable message list
src/lib/components/chat/message-bubble.svelte     # Single message (markdown render)
src/lib/components/chat/chat-input.svelte         # Textarea + send button
src/lib/components/layout/sidebar.svelte          # Conversation list sidebar
src/lib/components/layout/app-layout.svelte       # Shell layout (sidebar + main)
src/lib/stores/chat.ts                            # Chat state (conversations, messages)
src/lib/stores/settings.ts                        # User preferences (model, theme)
src/lib/services/ai-client.ts                     # Vercel AI SDK client config
src/lib/services/tauri-commands.ts                # Typed wrappers for Tauri invoke()
src/routes/+layout.svelte                         # Root layout
src/routes/+page.svelte                           # Chat page (default route)
src/routes/settings/+page.svelte                  # Settings page
```

### Rust Backend (Tauri)
```
src-tauri/src/main.rs                             # Tauri entry point
src-tauri/src/lib.rs                              # App setup, plugin registration
src-tauri/src/commands/mod.rs                     # Command module exports
src-tauri/src/commands/conversations.rs           # Conversation + message CRUD commands
src-tauri/src/db/mod.rs                           # DB init, connection pool
src-tauri/src/db/schema.rs                        # CREATE TABLE migrations
```

### Proxy Server (CF Workers)
```
proxy/src/index.ts                                # Hono app: routes, middleware
proxy/wrangler.toml                               # CF Workers config
proxy/package.json                                # Dependencies (hono, @hono/zod-validator)
```

## Implementation Steps

### Step 1: Scaffold Tauri + SvelteKit
1. `pnpm create tauri-app vibe-recruiter --template sveltekit-ts`
2. Hoac manual: `pnpm create svelte@latest` + `pnpm tauri init`
3. Cau hinh SvelteKit SPA mode:
   ```js
   // svelte.config.js
   import adapter from '@sveltejs/adapter-static';
   export default { kit: { adapter: adapter({ fallback: 'index.html' }) } };
   ```
4. Install core deps:
   ```bash
   pnpm add -D tailwindcss @tailwindcss/typography
   pnpm add ai @ai-sdk/svelte @ai-sdk/openai @ai-sdk/anthropic
   pnpm add marked dompurify
   ```
5. Setup shadcn-svelte: `pnpm dlx shadcn-svelte@latest init`
6. Add components: `pnpm dlx shadcn-svelte@latest add button input textarea scroll-area separator`

### Step 2: Tauri Rust Backend - DB + Migration Framework
<!-- Red Team: No data migration strategy — 2026-02-22 -->
1. Add Rust deps in `Cargo.toml`:
   ```toml
   rusqlite = { version = "0.32", features = ["bundled"] }
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   uuid = { version = "1", features = ["v4"] }
   tauri-plugin-sql = "2"
   ```
2. **Build numbered migration framework FIRST** (`db/migrations.rs`):
   - Each migration = version number + up SQL + down SQL
   - Track via `PRAGMA user_version`
   - Run sequentially on app start, skip already-applied
   - Support rollback for failed migrations
   ```rust
   struct Migration { version: i32, up: &'static str, down: &'static str }
   fn run_migrations(conn: &Connection, migrations: &[Migration]) -> Result<()>;
   ```
3. Migration V1: CREATE TABLE cho `conversations`, `messages`, `settings`
4. Implement `db/mod.rs` - init DB, run migrations on app start
5. Implement `commands/conversations.rs`:
   - `create_conversation(title) -> Conversation`
   - `list_conversations() -> Vec<Conversation>`
   - `delete_conversation(id)`
   - `get_messages(conversation_id) -> Vec<Message>`
   - `save_message(conversation_id, role, content) -> Message`
5. Register commands trong `lib.rs` via `tauri::Builder::default().invoke_handler()`

### Step 3: Chat UI Components
1. `app-layout.svelte` - CSS grid: sidebar 280px | main flex-1
2. `sidebar.svelte` - conversation list, "New Chat" button, active state highlight
3. `chat-panel.svelte` - container cho message-list + chat-input, manage chat state
4. `message-list.svelte` - scroll container, auto-scroll on new message
5. `message-bubble.svelte` - differentiate user/assistant, render markdown via `marked` + `DOMPurify.sanitize()`
6. `chat-input.svelte` - auto-resize textarea, Ctrl+Enter to send, loading state

### Step 4: Vercel AI SDK Integration
<!-- Red Team: Verify AI SDK client-side + Proxy auth from day 1 — 2026-02-22 -->
1. **VERIFY FIRST**: Test that `@ai-sdk/svelte` `useChat` works in Tauri webview. If `generateText`/`streamText` don't work client-side, pivot to proxy-side agent execution (Phase 3 fallback).
2. `ai-client.ts` - configure provider with static API key (NOT literal):
   ```ts
   import { createOpenAI } from '@ai-sdk/openai';
   export function getProvider(model: string) {
     const proxyUrl = import.meta.env.VITE_PROXY_URL;
     const apiKey = await invoke('get_auth_token'); // or static dev key from env
     return createOpenAI({ baseURL: `${proxyUrl}/v1`, apiKey });
   }
   ```
<!-- Updated: Validation Session 1 - Unified streamText architecture, no useChat -->
2. **DO NOT use `useChat`**. Build custom chat state manager wrapping `streamText`:
   ```ts
   // src/lib/services/chat-manager.ts
   import { streamText } from 'ai';
   export function createChatManager() {
     let messages = $state<Message[]>([]);
     let isLoading = $state(false);
     async function send(input: string, tools?: Record<string, Tool>) {
       messages.push({ role: 'user', content: input });
       isLoading = true;
       const result = streamText({
         model: getProvider(settings.model),
         messages, tools,
         maxSteps: tools ? 10 : 1,
       });
       let assistantMsg = '';
       for await (const chunk of result.textStream) {
         assistantMsg += chunk;
         // reactive update
       }
       messages.push({ role: 'assistant', content: assistantMsg });
       await invoke('save_message', { ... });
       isLoading = false;
     }
     return { messages, isLoading, send };
   }
   ```
3. This same architecture supports tools in Phase 3 — just pass `tools` param.
4. Load message history tu Tauri khi select conversation

### Step 5: CF Workers Proxy Server
1. `pnpm create cloudflare@latest proxy -- --template hono`
2. Implement routes trong `src/index.ts`:
   ```ts
   import { Hono } from 'hono';
   import { cors } from 'hono/cors';
   const app = new Hono();
   // Red Team: Restrict CORS + static API key from day 1
   app.use('*', cors({ origin: ['tauri://localhost', 'http://localhost:1420'] }));
   // Auth middleware: validate static API key (dev) or JWT (prod)
   app.use('/v1/*', authMiddleware);
   // Proxy: forward to OpenAI/Anthropic based on model param
   app.post('/v1/chat/completions', async (c) => {
     const body = await c.req.json();
     const provider = resolveProvider(body.model);
     return fetch(provider.url, { headers: { Authorization: `Bearer ${env.API_KEY}` }, body: JSON.stringify(body) });
   });
   // Rate limiting: 60 req/min per user via CF KV
   ```
3. Cau hinh `wrangler.toml` voi KV namespaces cho rate limiting
4. Deploy: `pnpm wrangler deploy`

### Step 6: Stores & Settings
1. `chat.ts` - writable stores: `currentConversation`, `conversations`, `messages`
2. `settings.ts` - persisted via Tauri store: `{ model: 'gpt-4o', theme: 'system' }`
3. Sync stores with Tauri backend on app load
<!-- Updated: Validation Session 1 - Ollama support in MVP -->
4. Settings page: model selector (OpenAI/Claude/Ollama), theme toggle, proxy URL config, Ollama URL input, save to SQLite
5. Ollama provider in `ai-client.ts`: when model starts with `ollama:`, use `createOpenAI({ baseURL: ollamaUrl, apiKey: 'ollama' })` — bypass proxy, connect directly

## Todo List

- [x] Scaffold Tauri v2 + SvelteKit project
- [x] Configure SPA mode (adapter-static)
- [x] Install and setup Tailwind CSS
- [ ] Install and init shadcn-svelte
- [x] Setup Rust SQLite DB with schema migrations
- [x] Implement Rust conversation CRUD commands
- [x] Implement Rust message save/get commands
- [x] Build app-layout (sidebar + main panel)
- [x] Build sidebar with conversation list
- [x] Build chat-panel with message-list and chat-input
- [x] Build message-bubble with markdown rendering
- [x] Integrate Vercel AI SDK (streamText, not useChat)
- [x] Create CF Workers proxy project
- [x] Implement LLM proxy route with auth middleware
- [x] Implement rate limiting (KV-based)
- [x] Build settings page (model, theme, proxy key)
- [x] Wire up stores with Tauri backend persistence
- [ ] Test streaming chat end-to-end
- [ ] Test conversation CRUD lifecycle
- [x] Setup GitHub Actions CI (lint + typecheck + build)
- [x] Define D1 users table schema in proxy
- [x] Add Ollama provider option in settings + ai-client

## Success Criteria
- Chat voi AI streaming response, markdown rendered correctly
- Conversations persist across app restarts (SQLite)
- Proxy server authenticate va forward requests thanh cong
- Sidebar shows conversation list, click to switch
- Settings luu va apply (model switch, theme)
- App khoi dong < 3s, first token < 2s

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Vercel AI SDK `useChat` ko tuong thich SPA mode (ko co server route) | Dung `api` param tro thang toi proxy URL, bypass SvelteKit server |
| Tauri IPC overhead cho message persistence | Batch save, ko save tung token ma save whole message on finish |
| CF Workers cold start latency | Enable Smart Placement, dung streaming de mask latency |
| shadcn-svelte version conflicts voi SvelteKit | Pin versions, test truoc khi upgrade |
| SQLite concurrent access tu multiple Tauri commands | Dung connection pool hoac single-writer pattern |
