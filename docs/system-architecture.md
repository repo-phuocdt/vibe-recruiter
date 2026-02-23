# System Architecture - Vibe Recruiter

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│            Tauri Desktop Application                      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Frontend (SvelteKit SPA)                            ││
│  │  ├─ Chat UI (Claude-style)                           ││
│  │  ├─ Settings Page                                    ││
│  │  └─ Stores (chat-store, settings-store)             ││
│  │     Powered by Svelte 5 Runes                        ││
│  └──────────────────────────────────────────────────────┘│
│                          ↓                                │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Rust Backend (Tauri Commands)                       ││
│  │  ├─ SQLite Database Layer                            ││
│  │  │  ├─ Conversations table                           ││
│  │  │  └─ Messages table                                ││
│  │  ├─ Command Handlers                                 ││
│  │  │  ├─ create_conversation()                         ││
│  │  │  ├─ list_conversations()                          ││
│  │  │  ├─ rename_conversation()                         ││
│  │  │  ├─ delete_conversation()                         ││
│  │  │  ├─ get_messages()                                ││
│  │  │  └─ save_message()                                ││
│  │  └─ Connection Pool (Mutex<Connection>)              ││
│  └──────────────────────────────────────────────────────┘│
│                                                            │
└──────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│  LLM Proxy (CloudFlare Workers + Hono.js)                │
├─────────────────────────────────────────────────────────┤
│  ├─ Auth Middleware (Bearer token, constant-time check)  │
│  ├─ Rate Limiter (KV-based, 60/min per key)             │
│  └─ Model Router                                         │
│     ├─ Claude models → Anthropic API                     │
│     ├─ GPT models → OpenAI API                           │
│     └─ Ollama models → Bypass proxy (direct from app)   │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│  External LLM Services                                   │
│  ├─ OpenAI API                                           │
│  ├─ Anthropic API                                        │
│  └─ Local Ollama Instance                               │
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
- `app-layout.svelte` - Main layout (sidebar + content)
- `sidebar.svelte` - Conversation list and navigation

**Stores (Svelte 5 Runes):**
- `chat-store.ts` - Reactive state for conversations & messages
- `settings-store.ts` - User settings (model, theme, API config)

**Services:**
- `ai-client.ts` - LLM provider factory (OpenAI-compatible)
- `chat-manager.ts` - Streaming text handler using `streamText` from `ai` SDK
- `tauri-commands.ts` - Tauri command invocations

### Rust Backend (Tauri)

**Entry Point:** `src-tauri/src/main.rs`

**Database Module:** `src-tauri/src/db/mod.rs`
- Initializes SQLite connection at startup
- Sets up database directory in app data folder
- Manages connection pooling via `Mutex<Connection>`

**Migrations:** `src-tauri/src/db/migrations.rs`
- Version-based migration system
- Creates tables: conversations, messages, settings
- Enforces foreign key constraints

**Commands:** `src-tauri/src/commands/conversations.rs`
- All commands return `Result<T, AppError>` for error handling
- Parameters validated via Rust's type system
- Responses serialized to JSON

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
- `POST /v1/chat/completions` - Model-aware routing

**Model Routing Logic:**
- Detect model name (contains 'claude' → Anthropic)
- Transform OpenAI format to Anthropic messages format
- Forward request to appropriate upstream API

## Data Flow

### Chat Message Flow

```
User Input (chat-input.svelte)
    ↓
createChatManager.send() [chat-manager.ts]
    ↓
Add user message to state, stream placeholder assistant message
    ↓
streamText() [ai SDK]
    ↓
POST /v1/chat/completions → Proxy [with auth header]
    ↓
Proxy: Auth check → Rate limit → Model routing
    ↓
OpenAI/Anthropic/Ollama API
    ↓
Stream response back
    ↓
Update assistant message content reactively ($state update)
    ↓
save_message() [Tauri command] - Fire-and-forget persistence
    ↓
SQLite INSERT (conversations updated_at also updated)
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

## Future Extensibility

- **Phase 2 (RAG)**: Add embeddings table, vector store integration
- **Phase 4 (Dashboard)**: Add new routes, candidate/job tables
- **Tool Calling**: streamText already supports tool definitions
