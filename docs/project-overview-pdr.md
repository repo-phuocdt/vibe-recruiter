# Vibe Recruiter - Product Development Requirements

## Product Overview

**Vibe Recruiter** is a desktop AI chatbox for recruiters, providing an agentic interface to manage candidates and recruitment workflows using Claude-style chat UI with multi-provider LLM support.

### Target Users
Recruiters needing AI-assisted candidate management and analysis.

### Key Features (Current & Planned)

#### Phase 1 (Completed)
- Claude-style chat UI with Svelte 5 runes
- Multi-provider LLM support (OpenAI, Claude/Anthropic, Ollama)
- Conversation persistence (SQLite backend)
- Settings page for model/provider configuration

#### Phase 2 (Completed)
- RAG (Retrieval-Augmented Generation) on CV/JD documents
- Document ingestion and vector embeddings
- Semantic search across candidate & job data

#### Phase 3 (Implemented)
- Agent-based tool calling system with 6 tools
- Multi-step agent loops (up to 10 steps per request)
- Candidate ranking by job relevance
- CV parsing from PDFs
- Professional email drafting
- Web search integration (Serper.dev)
- Pipeline report generation
- Tool execution indicators & results UI

#### Phase 4 (Planned)
- Recruitment dashboard for candidate management
- Analytics and metrics views
- Bulk operations & candidate filtering

## Technical Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Desktop Framework** | Tauri | v2 |
| **Frontend** | SvelteKit + Svelte 5 | Latest |
| **Frontend State** | Svelte Runes ($state, $derived, $effect) | 5.x |
| **LLM Integration** | Vercel AI SDK | v6+ |
| **Backend** | Rust (Tauri commands) | 1.77.2+ |
| **Database** | SQLite (rusqlite) | Latest |
| **Proxy/Gateway** | CloudFlare Workers + Hono | Latest |
| **Styling** | Tailwind CSS v4 | 4.x |
| **Security** | DOMPurify for HTML sanitization | 3.x |
| **Tool Validation** | Zod schema validation | v4+ |
| **Web Search** | Serper.dev API | Latest |

## Architecture Overview

```
┌─────────────────────────┐
│  Desktop Application    │
│  (Tauri v2)            │
├─────────────────────────┤
│  Frontend (SvelteKit)   │
│  - Chat UI              │
│  - Settings Page        │
│  - Svelte 5 Runes       │
├─────────────────────────┤
│  Rust Backend           │
│  - SQLite (conversations/messages)
│  - Migration framework  │
├─────────────────────────┤
│  CloudFlare Worker      │
│  Proxy (Hono.js)        │
│  - OpenAI routing       │
│  - Claude routing       │
│  - Rate limiting        │
│  - Auth middleware      │
└─────────────────────────┘
```

## Data Model

### Conversations
- `id` (TEXT, PRIMARY KEY)
- `title` (TEXT)
- `created_at` (TEXT)
- `updated_at` (TEXT)

### Messages
- `id` (TEXT, PRIMARY KEY)
- `conversation_id` (TEXT, FK → Conversations)
- `role` (TEXT: 'user', 'assistant', 'system')
- `content` (TEXT)
- `tool_calls` (TEXT, JSON array of tool call objects - Phase 3)
- `created_at` (TEXT)

### Settings
- `key` (TEXT, PRIMARY KEY)
- `value` (TEXT)

### Candidates (Phase 3)
- `id` (TEXT, PRIMARY KEY)
- `name` (TEXT)
- `email` (TEXT)
- `skills` (TEXT, JSON array)
- `experience_years` (INTEGER)
- `education` (TEXT)
- `embedding_id` (TEXT, FK → Embeddings)
- `parsed_cv` (TEXT, JSON from PDF parsing)
- `created_at` (TEXT)

### Jobs (Phase 3)
- `id` (TEXT, PRIMARY KEY)
- `title` (TEXT)
- `description` (TEXT)
- `required_skills` (TEXT, JSON array)
- `embedding_id` (TEXT, FK → Embeddings)
- `created_at` (TEXT)

### Embeddings (Phase 3)
- `id` (TEXT, PRIMARY KEY)
- `type` (TEXT: 'candidate', 'job')
- `entity_id` (TEXT, FK → Candidates or Jobs)
- `vector` (BLOB, embedding vector)
- `created_at` (TEXT)

### Applications (Phase 3)
- `id` (TEXT, PRIMARY KEY)
- `candidate_id` (TEXT, FK → Candidates)
- `job_id` (TEXT, FK → Jobs)
- `status` (TEXT: 'applied', 'reviewed', 'rejected', 'offered')
- `created_at` (TEXT)

## API Integration

### LLM Routing
- **OpenAI models**: Proxy → OpenAI API
- **Claude models**: Proxy → Anthropic API (with format transformation)
- **Ollama models**: Desktop app → Local Ollama instance (no proxy)

### Proxy Endpoints
- `POST /v1/chat/completions` - Chat completion with model routing
- `POST /v1/search` - Web search via Serper.dev (Phase 3, requires SERPER_API_KEY)
- `GET /health` - Health check (no auth required)

### Security
- Bearer token auth on `/v1/*` endpoints
- Constant-time comparison for token validation
- Rate limiting (60 req/min per API key)
- Serper API key stored on proxy (not in app)
- Tool input validation via Zod schemas (Phase 3)

## Development Guidelines

- **Svelte Files**: kebab-case naming (e.g., `chat-input.svelte`)
- **TypeScript Files**: kebab-case naming (e.g., `ai-client.ts`, `search-candidates.ts`)
- **Rust Files**: snake_case naming (e.g., `conversations.rs`)
- **File Size**: Max 200 lines per component/module
- **SQL Queries**: Parameterized (prepared statements)
- **HTML Content**: Sanitized via DOMPurify
- **Tool Definitions**: Use Zod for input schema validation (Phase 3)
- **Agent System Prompt**: Enhanced with tool capabilities & guidelines (Phase 3)

## Success Metrics

- Chat UI responsive with <300ms message latency
- SQLite persistence without UI blocking
- Multi-provider routing without user friction
- Settings persistence across sessions
