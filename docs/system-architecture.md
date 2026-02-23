# System Architecture - Vibe Recruiter

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│            Tauri Desktop Application                      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Frontend (SvelteKit SPA)                            ││
│  │  ├─ Chat UI (Claude-style) + Agent Tools            ││
│  │  ├─ Tool Indicator & Results (Phase 3)              ││
│  │  ├─ Recruitment Dashboard (Phase 4)                 ││
│  │  ├─ Pipeline Kanban Board with Drag-Drop (Phase 4)  ││
│  │  ├─ Candidates/Jobs Management (Phase 3)            ││
│  │  ├─ Settings Page                                    ││
│  │  └─ Stores (chat, settings, dashboard, etc.)        ││
│  │     Powered by Svelte 5 Runes                        ││
│  └──────────────────────────────────────────────────────┘│
│                          ↓                                │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Agent & Tools Engine (Frontend - Phase 3)           ││
│  │  ├─ agent.ts: streamText + tool orchestration        ││
│  │  ├─ tools/: searchCandidates, rankCandidates, etc   ││
│  │  └─ Zod schemas for tool input validation            ││
│  └──────────────────────────────────────────────────────┘│
│                          ↓                                │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Rust Backend (Tauri Commands)                       ││
│  │  ├─ SQLite Database Layer                            ││
│  │  │  ├─ Conversations, Messages (tool_calls col)      ││
│  │  │  ├─ Candidates, Jobs (Phase 3)                    ││
│  │  │  ├─ Embeddings, Applications (Phase 3)            ││
│  │  │  └─ Settings table                                ││
│  │  ├─ Command Handlers                                 ││
│  │  │  ├─ Conversations: CRUD + save_message           ││
│  │  │  ├─ Candidates: rank_candidates (Phase 3)        ││
│  │  │  ├─ Jobs: generate_report_data (Phase 3)         ││
│  │  │  ├─ Embeddings: vector search ops (Phase 3)      ││
│  │  │  └─ Analytics: dashboard stats & pipeline mgt (Phase 4) ││
│  │  └─ Connection Pool (Mutex<Connection>)              ││
│  └──────────────────────────────────────────────────────┘│
│                                                            │
└──────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│  LLM Proxy (CloudFlare Workers + Hono.js)                │
├─────────────────────────────────────────────────────────┤
│  ├─ Auth Middleware (Bearer token, constant-time)       │
│  ├─ Rate Limiter (KV-based, 60/min per key)             │
│  ├─ Model Router                                         │
│  │  ├─ Claude models → Anthropic API                    │
│  │  ├─ GPT models → OpenAI API                          │
│  │  └─ Ollama models → Direct (bypass proxy)            │
│  └─ Web Search Route (Phase 3)                           │
│     └─ POST /v1/search → Serper.dev API                 │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│  External Services                                       │
│  ├─ LLM APIs: OpenAI, Anthropic, Ollama                 │
│  ├─ Web Search: Serper.dev (Phase 3)                    │
│  └─ Vector Embeddings: Local SQLite store               │
└─────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend (SvelteKit)

**Entry Point:** `src/routes/+page.svelte`

**Key Components:**
- `chat-panel.svelte` - Main chat UI container
- `message-list.svelte` - Scrollable message history
- `chat-input.svelte` - User input field with send button
- `message-bubble.svelte` - Individual message rendering
- `tool-indicator.svelte` - Tool execution status badge (Phase 3)
- `tool-result.svelte` - Expandable tool result display (Phase 3)
- `app-layout.svelte` - Main layout (sidebar + content)
- `sidebar.svelte` - Conversation list and navigation
- `sidebar-nav.svelte` - Top navigation with route links (Phase 4)
- `stats-cards.svelte` - Dashboard metrics display (Phase 4)
- `pipeline-board.svelte` - Kanban-style board with 6 stages & drag-drop (Phase 4)
- `candidate-pipeline-card.svelte` - Individual candidate card in pipeline (Phase 4)
- `simple-bar-chart.svelte` - Bar chart for analytics visualization (Phase 4)
- `error-boundary.svelte` - Global error handler (catches unhandledrejection + error events) (Phase 5)
- `offline-banner.svelte` - Shows when offline, disables chat/AI features (Phase 5)
- `usage-display.svelte` - Displays monthly request/token usage with progress bars (Phase 5)

**Stores (Svelte 5 Runes):**
- `chat-store.svelte.ts` - Reactive state for conversations & messages
- `settings-store.svelte.ts` - User settings (model, theme, API config)
- `candidates-store.svelte.ts` - Candidate state management (Phase 3)
- `jobs-store.svelte.ts` - Job listings state (Phase 3)
- `dashboard-store.svelte.ts` - Dashboard UI state with optimistic updates for drag-drop pipeline (Phase 4)
- `auth-store.svelte.ts` - Authentication state (user, tokens, login status) (Phase 5)

**Services:**
- `ai-client.ts` - LLM provider factory (OpenAI-compatible)
- `agent.ts` - Agent orchestrator with tool calling (Phase 3)
- `chat-manager.ts` - Streaming chat + tools via runAgent()
- `rag.ts` - RAG context generation (Phase 3)
- `tauri-commands.ts` - Tauri command invocations wrapper
- `auth-client.ts` - Auth API client (login, register, refresh, logout, usage) (Phase 5)
- `tools/` - Tool definitions with Zod schemas (Phase 3)
  - `search-candidates.ts` - Vector similarity search
  - `rank-candidates.ts` - Ranking by job relevance
  - `parse-cv.ts` - CV extraction
  - `draft-email.ts` - Email composition
  - `search-web.ts` - Web search via Serper
  - `generate-report.ts` - Report generation

### Rust Backend (Tauri)

**Entry Point:** `src-tauri/src/main.rs`

**Database Module:** `src-tauri/src/db/mod.rs`
- Initializes SQLite connection at startup
- Sets up database directory in app data folder
- Manages connection pooling via `Mutex<Connection>`

**Migrations:** `src-tauri/src/db/migrations.rs`
- Version-based migration system
- Migration 1: Phase 1 tables (conversations, messages, settings)
- Migration 2: Phase 3 tables (candidates, jobs, applications, embedding_chunks)
- Migration 3: Phase 3 tool_calls TEXT column on messages
- Migration 4: Phase 4 indexes on applications table (status, job_id, candidate_id) for query performance
- Enforces foreign key constraints

**Commands:**
- `commands/conversations.rs` - Chat CRUD + save_message with tool_calls
- `commands/candidates.rs` - Candidate ranking & data ops (Phase 3)
- `commands/jobs.rs` - Job reports & analytics (Phase 3)
- `commands/embeddings.rs` - Vector search operations (Phase 3)
- `commands/analytics.rs` - Dashboard stats (6 commands for metrics, pipeline, analytics) (Phase 4)

All commands return `Result<T, AppError>` for error handling, parameters validated via Rust's type system, responses serialized to JSON.

**Error Handling:** `src-tauri/src/error.rs`
- Custom `AppError` type wrapping rusqlite/IO errors

### LLM Proxy (CloudFlare Workers)

**Entry Point:** `proxy/src/index.ts`

**Middleware Stack:**
1. CORS - Allows Tauri localhost origins
2. Auth - JWT bearer token OR legacy PROXY_API_KEY (constant-time comparison)
3. Rate Limiter - KV-based tracking (60 req/min)

**Routes:**
- `GET /health` - No auth required, returns environment status
- `POST /v1/chat/completions` - Model-aware routing (chat completions)
- `POST /v1/search` - Web search endpoint (Phase 3, SERPER_API_KEY)
- `POST /auth/register` - Create new user account with email + password (Phase 5)
- `POST /auth/login` - Authenticate user, returns JWT tokens (Phase 5)
- `POST /auth/refresh` - Refresh expired access token (Phase 5)
- `POST /auth/logout` - Revoke refresh token (Phase 5)
- `GET /usage` - Return monthly usage stats for authenticated user (Phase 5)

**Model Routing Logic:**
- Detect model name (contains 'claude' → Anthropic)
- Transform OpenAI format to Anthropic messages format
- Forward request to appropriate upstream API (OpenAI/Anthropic/Ollama)

**Web Search Route (Phase 3):**
- Validates auth token
- Proxies search query to Serper.dev API
- Returns structured search results to agent tools

**Authentication System (Phase 5):**
- User accounts stored in Cloudflare D1 database (proxy)
- Password hashing: PBKDF2 with SHA-256 (100,000 iterations) via Web Crypto API
- JWT signing: HS256 with JWT_SECRET (required env var on proxy)
- Access token: 1 hour expiration (contains user id, email, plan)
- Refresh token: 7 day expiration (stored in KV cache for revocation)
- Backward compatible: accepts JWT OR legacy PROXY_API_KEY
- Soft auth guard: initAuth() on app mount, silent failure if proxy unavailable

## Data Flow

### JWT Authentication Flow (Phase 5)

```
User Registration/Login
    ↓
Frontend: /auth/login or /auth/register page
    ↓
POST /auth/register or /auth/login with email + password
    ↓
Proxy: Validate email format, hash password (PBKDF2)
    ↓
DB: Check user exists (login) or insert new user (register)
    ↓
Generate JWT tokens: accessToken (1h) + refreshToken (7d)
    ↓
Store refreshToken in KV cache (for revocation tracking)
    ↓
Return { accessToken, refreshToken, user: {id, email, plan} }
    ↓
Frontend: storeAuthToken() → Tauri Plugin Store (.auth.dat, encrypted)
    ↓
Update authStore → isAuthenticated = true
    ↓

Token Usage (Chat/API Calls)
    ↓
Include Authorization: Bearer {accessToken} in requests
    ↓
Proxy middleware: jwtVerify() against JWT_SECRET
    ↓
Extract userId from JWT payload
    ↓
Forward request with userId context
    ↓

Token Refresh (when access token expires)
    ↓
Frontend: POST /auth/refresh with refreshToken
    ↓
Proxy: Verify refreshToken against KV stored token
    ↓
Generate new accessToken (same user, plan)
    ↓
Return new accessToken
    ↓
Frontend: Update stored token, continue request
    ↓

Logout
    ↓
DELETE refreshToken from KV cache (revocation)
    ↓
Frontend: clearAuthToken() → remove from Tauri Plugin Store
    ↓
Update authStore → isAuthenticated = false
    ↓

Token Storage (Frontend)
    ↓
Tauri Plugin Store: .auth.dat file (encrypted)
    ↓
Contains: { accessToken, refreshToken }
    ↓
Persists across app restarts
    ↓
initAuth() on mount attempts token refresh
    ↓
Silent failure: stays logged out if refresh fails
```

### Chat Message Flow with Tools (Phase 3)

```
User Input (chat-input.svelte)
    ↓
createChatManager.send() [chat-manager.ts]
    ↓
Add user message to state, stream placeholder assistant message
    ↓
runAgent() [agent.ts] with tool registry
    ↓
streamText() with allTools + stepCountIs(10) [ai SDK v6]
    ↓
POST /v1/chat/completions → Proxy [with auth header]
    ↓
Proxy: Auth check → Rate limit → Model routing
    ↓
OpenAI/Anthropic/Ollama API (with tool definitions)
    ↓
Model decides: respond OR invoke tool
    ↓ (if tool call)
Agent invokes tool (e.g., searchCandidates)
    ↓
Tool validates args via Zod schema, invokes Tauri command
    ↓
Rust backend: vector search/ranking, returns results
    ↓
Tool formats result, returns to agent
    ↓ (if more steps needed, loop back to model)
Agent incorporates results into final response
    ↓
Stream final response back
    ↓
Update assistant message content + tool_calls JSON ($state)
    ↓
Tool indicator shows execution status in UI
    ↓
save_message() [Tauri command] with tool_calls JSON
    ↓
SQLite INSERT messages (tool_calls persisted)
```

### Conversation Persistence

```
selectConversation() [chat-store.ts]
    ↓
get_messages(conversation_id) [Tauri command]
    ↓
SQLite SELECT from messages table
    ↓
Deserialized to Message[] in TypeScript
    ↓
chat-manager.loadMessages() [reactive update]
    ↓
Message list rendered in UI
```

## Technology Decisions

### Why Svelte 5 Runes?
- Fine-grained reactivity without Virtual DOM
- $state, $derived, $effect provide explicit reactive patterns
- Smaller bundle size for desktop app

### Why SQLite?
- Zero-configuration local database
- Single file, portable, no separate service
- Good performance for conversation management
- Native Rust support via rusqlite

### Why CloudFlare Workers for Proxy?
- Serverless, no infrastructure to manage
- Built-in rate limiting via KV
- Support for multiple API keys/rate limit buckets
- Fast global edge network

### Why Hono.js?
- Lightweight, edge-runtime compatible
- Excellent TypeScript support
- Simple middleware composition

## Security Considerations

1. **Bearer Token Auth**: Constant-time comparison prevents timing attacks
2. **Parameterized SQL**: All queries use ? placeholders (no injection risk)
3. **CORS**: Whitelists only Tauri localhost origins
4. **DOMPurify**: Sanitizes rendered message content (HTML-safe)
5. **No Local API Keys**: Settings store only holds proxy key; upstream keys stored on proxy

## Performance Characteristics

| Operation | Target | Implementation |
|-----------|--------|-----------------|
| Message send-to-stream | <300ms | Direct API relay via proxy |
| Conversation load | <100ms | SQLite query with 50-message limit |
| Settings save | Async | localStorage + no blocking |
| UI updates | 60 FPS | Svelte runes + fine-grained reactivity |

## Phase 3 Architecture Changes

**Key Additions:**
1. **Agent Orchestration**: `agent.ts` with `runAgent()` replaces direct `streamText()` calls
2. **Tool Registry**: 6 tools with Zod schema validation (`tools/index.ts`)
3. **Message Enhancement**: tool_calls JSON column tracks tool invocations
4. **AI SDK v6**: Uses `inputSchema` (not `parameters`), `stepCountIs(10)`, `ModelMessage`
5. **Vector Store**: embeddings table + similarity search in Rust backend
6. **Recruiter Prompt**: System prompt enhanced with tool capabilities & guidelines

**Database Schema Changes:**
- Migration 3 adds `tool_calls TEXT` column to messages
- New tables: candidates, jobs, embeddings, applications
- Candidate embeddings enable semantic search by skills/experience

## Future Extensibility

- **Phase 2 (RAG)**: ~~Add embeddings table~~ Done in Phase 3
- **Phase 4 (Dashboard)**: ~~Expand candidate/job routes, add analytics views~~ Completed
- **Phase 5**: Document ingestion pipeline for CV/JD processing, enhanced RAG retrieval
- **Phase 6+**: Bulk operations, advanced filtering, interview scheduling, email templates
