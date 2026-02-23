# Codebase Summary - Vibe Recruiter

## Directory Structure

```
vibe-recruiter/
├── src/                          # Frontend (SvelteKit)
│   ├── routes/                   # Page components
│   ├── lib/
│   │   ├── components/           # Reusable UI components
│   │   ├── stores/               # Svelte state stores
│   │   ├── services/             # Business logic
│   │   └── types.ts              # TypeScript interfaces
│   ├── app.d.ts                  # Global type definitions
│   └── +layout.svelte            # Root layout
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri command handlers
│   │   ├── db/                   # Database module
│   │   ├── error.rs              # Error types
│   │   ├── lib.rs                # Library entry
│   │   └── main.rs               # App entry
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri config
├── proxy/                        # CloudFlare Workers
│   └── src/                      # Worker source
├── docs/                         # Documentation
├── package.json                  # npm dependencies
└── tsconfig.json                 # TypeScript config
```

## Frontend Files (src/)

### Routes & Pages
| File | Purpose |
|------|---------|
| `routes/+page.svelte` | Home page (chat interface) |
| `routes/+layout.svelte` | Root layout wrapper |
| `routes/settings/+page.svelte` | Settings page |
| `routes/+layout.ts` | Layout data loading |

### Components (lib/components/)

**Chat Module:**
- `chat/chat-panel.svelte` - Main chat container with message list & input
- `chat/message-list.svelte` - Scrollable message history
- `chat/chat-input.svelte` - User message input field
- `chat/message-bubble.svelte` - Individual message rendering with markdown

**Layout Module:**
- `layout/app-layout.svelte` - Main app layout (sidebar + content area)
- `layout/sidebar.svelte` - Conversation list & navigation

### Stores (lib/stores/)
| File | Purpose |
|------|---------|
| `chat-store.ts` | Conversation & message state (Svelte 5 runes) |
| `settings-store.ts` | User settings persistence (localStorage) |

### Services (lib/services/)
| File | Purpose |
|------|---------|
| `ai-client.ts` | LLM provider factory (OpenAI/Claude/Ollama) |
| `chat-manager.ts` | Streaming chat logic with `streamText` |
| `tauri-commands.ts` | Tauri command invocations wrapper |

### Type Definitions
| File | Purpose |
|------|---------|
| `types.ts` | Domain types (Conversation, Message, Settings) |
| `app.d.ts` | Global ambient types |

## Backend Files (src-tauri/src/)

### Commands
| File | Purpose |
|------|---------|
| `commands/conversations.rs` | CRUD operations for conversations & messages |
| `commands/mod.rs` | Command module exports |

**Exported Commands:**
- `create_conversation(title) → Conversation`
- `list_conversations() → Vec<Conversation>`
- `rename_conversation(id, title) → ()`
- `delete_conversation(id) → ()`
- `get_messages(conversation_id) → Vec<Message>`
- `save_message(conversation_id, role, content) → Message`

### Database Module (db/)
| File | Purpose |
|------|---------|
| `mod.rs` | Database initialization & connection pooling |
| `migrations.rs` | SQLite schema migrations |

**Tables Created:**
- `conversations` - Chat session metadata
- `messages` - Message history
- `settings` - Key-value settings (reserved for future)

### Error Handling
| File | Purpose |
|------|---------|
| `error.rs` | Custom `AppError` type with Display/Serialize impl |
| `lib.rs` | Library module organization |
| `main.rs` | Application entry point |

## Proxy Files (proxy/src/)

| File | Purpose |
|------|---------|
| `index.ts` | Hono app with routes & model routing |
| `auth-middleware.ts` | Bearer token validation (constant-time) |
| `rate-limiter.ts` | KV-based rate limiting (60 req/min) |

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Frontend & Tauri CLI dependencies |
| `tsconfig.json` | TypeScript compiler options |
| `svelte.config.js` | SvelteKit configuration |
| `vite.config.ts` | Vite build configuration |
| `src-tauri/Cargo.toml` | Rust dependencies & metadata |
| `src-tauri/tauri.conf.json` | Tauri app config (window, build, etc.) |

## Key Dependencies

### Frontend (package.json)
```
@sveltejs/kit         - SvelteKit framework
svelte                - Svelte 5 (runes)
@ai-sdk/openai        - OpenAI provider
@ai-sdk/anthropic     - Claude provider
@ai-sdk/svelte        - Svelte bindings for AI SDK
ai                    - Vercel AI library (streamText)
@tauri-apps/api       - Tauri frontend bridge
dompurify             - HTML sanitization
marked                - Markdown parser
tailwindcss           - CSS framework v4
```

### Backend (Cargo.toml)
```
tauri                 - Desktop framework
rusqlite              - SQLite driver (bundled)
serde_json            - JSON serialization
uuid                  - UUID generation
chrono                - Date/time utilities
thiserror             - Error derive macros
```

### Proxy (wrangler.toml - not shown)
```
hono                  - Web framework
@cloudflare/workers-types - CF Workers types
```

## Data Flow Summary

### Conversation Creation
1. User clicks "New Chat" in sidebar
2. `createNewChat()` called from `chat-store.ts`
3. Invokes Tauri command `create_conversation()`
4. Rust backend generates UUID, inserts into SQLite
5. Returns `Conversation` object, updates reactive store
6. UI re-renders with new conversation in sidebar

### Message Sending
1. User types message, clicks send in `chat-input.svelte`
2. `createChatManager.send()` invoked with message text
3. User message added to `$state`, placeholder assistant message created
4. `streamText()` called with LLM provider
5. Makes POST to `/v1/chat/completions` via proxy
6. Proxy validates auth, rate limit, routes to OpenAI/Anthropic/Ollama
7. Stream response updates reactive state in real-time
8. After stream completes, `save_message()` persists to SQLite

### Message Loading
1. User clicks conversation in sidebar
2. `selectConversation(id)` called
3. Invokes Tauri command `get_messages(id)`
4. Rust queries SQLite, returns `Vec<Message>`
5. `chat-manager.loadMessages()` updates reactive state
6. Message list re-renders with history

## Naming Conventions Applied

- **Frontend files**: kebab-case (chat-input.svelte, ai-client.ts)
- **Rust files**: snake_case (conversations.rs, migrations.rs)
- **Database tables**: plural, lowercase (conversations, messages)
- **Database columns**: snake_case (created_at, conversation_id)
- **Component exports**: camelCase for functions (createChatManager, getProvider)

## Module Boundaries

| Boundary | Responsibility |
|----------|-----------------|
| **Frontend (SvelteKit)** | UI rendering, user input, local state, settings persistence |
| **Backend (Rust)** | Database I/O, command execution, transaction management |
| **Proxy (CF Workers)** | Auth, rate limiting, LLM provider routing, API translation |
| **External APIs** | OpenAI, Anthropic, Ollama (not owned by this codebase) |

## Size Metrics

| Layer | File Count | Avg Lines | Max File |
|-------|-----------|-----------|----------|
| Frontend Components | 8 | ~80 | 150 |
| Services | 3 | ~90 | 150 |
| Rust Commands | 1 | ~150 | 150 |
| Rust DB | 2 | ~40 | 44 |
| Proxy | 3 | ~80 | 150 |

All files adhere to 200-line limit for maintainability.
