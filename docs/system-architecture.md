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
│  │  ├─ Candidates/Jobs Management (Phase 3)            ││
│  │  ├─ Settings Page                                    ││
│  │  └─ Stores (chat-store, settings-store)             ││
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
│  │  │  └─ Embeddings: vector search ops (Phase 3)      ││
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

**Stores (Svelte 5 Runes):**
- `chat-store.ts` - Reactive state for conversations & messages
- `settings-store.ts` - User settings (model, theme, API config)
- `candidates-store.ts` - Candidate state management (Phase 3)
- `jobs-store.ts` - Job listings state (Phase 3)

**Services:**
- `ai-client.ts` - LLM provider factory (OpenAI-compatible)
- `agent.ts` - Agent orchestrator with tool calling (Phase 3)
- `chat-manager.ts` - Streaming chat + tools via runAgent()
- `rag.ts` - RAG context generation (Phase 3)
- `tauri-commands.ts` - Tauri command invocations wrapper
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
- Creates Phase 1 tables: conversations, messages, settings
- Creates Phase 3 tables: candidates, jobs, embeddings, applications
- Adds tool_calls TEXT column to messages (Phase 3)
- Enforces foreign key constraints

**Commands:**
- `commands/conversations.rs` - Chat CRUD + save_message with tool_calls
- `commands/candidates.rs` - Candidate ranking & data ops (Phase 3)
- `commands/jobs.rs` - Job reports & analytics (Phase 3)
- `commands/embeddings.rs` - Vector search operations (Phase 3)

All commands return `Result<T, AppError>` for error handling, parameters validated via Rust's type system, responses serialized to JSON.

**Error Handling:** `src-tauri/src/error.rs`
- Custom `AppError` type wrapping rusqlite/IO errors

### LLM Proxy (CloudFlare Workers)

**Entry Point:** `proxy/src/index.ts`

**Middleware Stack:**
1. CORS - Allows Tauri localhost origins
2. Auth - Validates Bearer token with constant-time comparison
3. Rate Limiter - KV-based tracking (60 req/min)

**Routes:**
- `GET /health` - No auth required, returns environment status
- `POST /v1/chat/completions` - Model-aware routing (chat completions)
- `POST /v1/search` - Web search endpoint (Phase 3, SERPER_API_KEY)

**Model Routing Logic:**
- Detect model name (contains 'claude' → Anthropic)
- Transform OpenAI format to Anthropic messages format
- Forward request to appropriate upstream API (OpenAI/Anthropic/Ollama)

**Web Search Route (Phase 3):**
- Validates auth token
- Proxies search query to Serper.dev API
- Returns structured search results to agent tools

## Data Flow

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
- **Phase 4 (Dashboard)**: Expand candidate/job routes, add analytics views
- **Phase 5 (RAG)**: Document ingestion pipeline for CV/JD processing
