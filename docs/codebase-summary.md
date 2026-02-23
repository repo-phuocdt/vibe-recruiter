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
| `routes/+layout.svelte` | Root layout wrapper with sidebar-nav |
| `routes/dashboard/+page.svelte` | Dashboard overview with stats & pipeline board (Phase 4) |
| `routes/candidates/+page.svelte` | Candidates list page |
| `routes/candidates/[id]/+page.svelte` | Candidate detail page (Phase 4) |
| `routes/jobs/+page.svelte` | Jobs list page |
| `routes/jobs/[id]/+page.svelte` | Job detail page (Phase 4) |
| `routes/settings/+page.svelte` | Settings page |
| `routes/+layout.ts` | Layout data loading |

### Components (lib/components/)

**Chat Module:**
- `chat/chat-panel.svelte` - Main chat container with message list & input
- `chat/message-list.svelte` - Scrollable message history
- `chat/chat-input.svelte` - User message input field
- `chat/message-bubble.svelte` - Individual message rendering with markdown
- `chat/tool-indicator.svelte` - Tool execution status indicator (Phase 3)
- `chat/tool-result.svelte` - Expandable tool result display (Phase 3)

**Layout Module:**
- `layout/app-layout.svelte` - Main app layout (sidebar + content area)
- `layout/sidebar.svelte` - Conversation list & navigation
- `layout/sidebar-nav.svelte` - Navigation bar with route links (Phase 4)

**Dashboard Module (Phase 4):**
- `dashboard/stats-cards.svelte` - Key metrics display (total candidates, jobs, applications, hired)
- `dashboard/candidate-pipeline-card.svelte` - Individual candidate card with drag-drop support
- `dashboard/pipeline-board.svelte` - Kanban-style board with 6 stages (new, screening, interview, offer, hired, rejected)
- `dashboard/simple-bar-chart.svelte` - Bar chart for analytics visualization

**Analytics Module (Phase 4):**
- `analytics/simple-bar-chart.svelte` - Reusable bar chart component

**Candidates Module (Phase 3):**
- `candidates/` - Candidate management components

**Jobs Module (Phase 3):**
- `jobs/` - Job listing components

### Stores (lib/stores/)
| File | Purpose |
|------|---------|
| `chat-store.svelte.ts` | Conversation & message state (Svelte 5 runes) |
| `settings-store.svelte.ts` | User settings persistence (localStorage) |
| `candidates-store.svelte.ts` | Candidate state management (Phase 3) |
| `jobs-store.svelte.ts` | Job listings state (Phase 3) |
| `dashboard-store.svelte.ts` | Dashboard UI state with optimistic updates for pipeline management (Phase 4) |

### Services (lib/services/)
| File | Purpose |
|------|---------|
| `ai-client.ts` | LLM provider factory (OpenAI/Claude/Ollama) |
| `agent.ts` | Agent orchestrator with tool calling (streamText + tools) |
| `chat-manager.ts` | Streaming chat logic with agent & tool support |
| `tauri-commands.ts` | Tauri command invocations wrapper |
| `rag.ts` | RAG context generation for agent |

**Tools (lib/services/tools/):**
- `index.ts` - Tool registry with all 6 tools
- `search-candidates.ts` - Vector similarity search for candidates
- `parse-cv.ts` - Extract structured data from CVs
- `rank-candidates.ts` - Rank candidates by relevance
- `draft-email.ts` - Generate recruitment emails
- `search-web.ts` - Serper.dev web search integration
- `generate-report.ts` - Pipeline stats & summaries

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
| `commands/candidates.rs` | Candidate ranking & management (Phase 3) |
| `commands/jobs.rs` | Job management & report generation (Phase 3) |
| `commands/embeddings.rs` | Vector embedding operations (Phase 3) |
| `commands/analytics.rs` | Dashboard stats, pipeline management & analytics (Phase 4) |
| `commands/mod.rs` | Command module exports |

**Exported Commands (Phase 1):**
- `create_conversation(title) → Conversation`
- `list_conversations() → Vec<Conversation>`
- `rename_conversation(id, title) → ()`
- `delete_conversation(id) → ()`
- `get_messages(conversation_id) → Vec<Message>`
- `save_message(conversation_id, role, content, tool_calls?) → Message`

**Exported Commands (Phase 3):**
- `rank_candidates(job_id, candidate_ids) → Vec<RankedCandidate>`
- `generate_report_data(job_id) → ReportData`

**Exported Commands (Phase 4):**
- `get_dashboard_stats() → DashboardStats` - Total candidates, active jobs, applications, pipeline distribution, hired count
- `get_pipeline_candidates(stage?) → Vec<PipelineCandidate>` - Filter candidates by stage or list all
- `update_candidate_stage(application_id, new_stage) → ()` - Move candidate through pipeline (validates against 6 valid stages)
- `get_analytics_data() → AnalyticsData` - Aggregated metrics: candidates per job, stage distribution
- `create_application(candidate_id, job_id) → String` - Create new application, returns ID
- `get_job_applications(job_id) → Vec<PipelineCandidate>` - List all candidates applied to a job

### Database Module (db/)
| File | Purpose |
|------|---------|
| `mod.rs` | Database initialization & connection pooling |
| `migrations.rs` | SQLite schema migrations |

**Tables Created:**
- `conversations` - Chat session metadata
- `messages` - Message history + tool_calls JSON (Phase 3)
- `settings` - Key-value settings (reserved for future)
- `candidates` - Parsed CV data (Phase 3)
- `jobs` - Job listings (Phase 3)
- `embedding_chunks` - Vector store for semantic search (Phase 3)
- `applications` - Candidate-to-job applications (Phase 3)

**Indexes Created (Phase 4 - Migration 4):**
- `idx_applications_status` - Fast queries by application status
- `idx_applications_job_id` - Fast queries by job
- `idx_applications_candidate_id` - Fast queries by candidate

### Error Handling
| File | Purpose |
|------|---------|
| `error.rs` | Custom `AppError` type with Display/Serialize impl |
| `lib.rs` | Library module organization |
| `main.rs` | Application entry point |

## Proxy Files (proxy/src/)

| File | Purpose |
|------|---------|
| `index.ts` | Hono app with routes & model routing + web search (Phase 3) |
| `auth-middleware.ts` | Bearer token validation (constant-time) |
| `rate-limiter.ts` | KV-based rate limiting (60 req/min) |

**Routes (Phase 3):**
- `POST /v1/chat/completions` - Chat completion with model routing
- `POST /v1/search` - Serper.dev web search integration (requires SERPER_API_KEY)

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
ai                    - Vercel AI SDK v6+ (streamText + tools)
zod                   - Schema validation v4 (tool inputSchema)
@tauri-apps/api       - Tauri frontend bridge
dompurify             - HTML sanitization
marked                - Markdown parser
tailwindcss           - CSS framework v4
lucide-svelte         - Icon library (Phase 4)
svelte-dnd-action     - Drag-and-drop for pipeline board (Phase 4)
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

### Message Sending with Tools (Phase 3)
1. User types message, clicks send in `chat-input.svelte`
2. `createChatManager.send()` invoked with message text
3. User message added to `$state`, placeholder assistant message created
4. `runAgent()` called (agent.ts) with messages + tools
5. `streamText()` executes with `allTools` registry
6. Makes POST to `/v1/chat/completions` via proxy
7. Agent may invoke tools (up to 10 steps via stepCountIs)
8. Tool results stored as JSON in message.tool_calls
9. Stream response updates reactive state in real-time
10. After stream completes, `save_message()` persists with tool_calls to SQLite

### Tool Execution Flow
1. Agent decides to call tool (e.g., `searchCandidates`)
2. Tool receives typed arguments (validated by Zod schema)
3. Tool invokes Tauri command (e.g., `rank_candidates`)
4. Rust backend queries vector store, returns results
5. Tool formats results, returns to agent
6. Agent incorporates results into response
7. Tool indicator shows execution status to user
8. Tool result expandable in UI for inspection

### Message Loading
1. User clicks conversation in sidebar
2. `selectConversation(id)` called
3. Invokes Tauri command `get_messages(id)`
4. Rust queries SQLite, returns `Vec<Message>` with tool_calls
5. `chat-manager.loadMessages()` updates reactive state
6. Message list re-renders with history + tool results

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
