# Vibe Recruiter - Product Development Requirements

## Product Overview

**Vibe Recruiter** is a desktop AI chatbox for recruiters, providing an agentic interface to manage candidates and recruitment workflows using Claude-style chat UI with multi-provider LLM support.

### Target Users
Recruiters needing AI-assisted candidate management and analysis.

### Key Features (Current & Planned)

#### Phase 1 (Implemented)
- Claude-style chat UI with Svelte 5 runes
- Multi-provider LLM support (OpenAI, Claude/Anthropic, Ollama)
- Conversation persistence (SQLite backend)
- Settings page for model/provider configuration

#### Phase 2 (Planned)
- RAG (Retrieval-Augmented Generation) on CV/JD documents
- Document ingestion and indexing

#### Phase 4 (Planned)
- Recruitment dashboard for candidate management
- Analytics and metrics views

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
- `created_at` (TEXT)

### Settings
- `key` (TEXT, PRIMARY KEY)
- `value` (TEXT)

## API Integration

### LLM Routing
- **OpenAI models**: Proxy → OpenAI API
- **Claude models**: Proxy → Anthropic API (with format transformation)
- **Ollama models**: Desktop app → Local Ollama instance (no proxy)

### Proxy Endpoints
- `POST /v1/chat/completions` - Chat completion (model detection)
- `GET /health` - Health check (no auth required)

### Security
- Bearer token auth on `/v1/*` endpoints
- Constant-time comparison for token validation
- Rate limiting (60 req/min per API key)

## Development Guidelines

- **Svelte Files**: kebab-case naming (e.g., `chat-input.svelte`)
- **TypeScript Files**: kebab-case naming (e.g., `ai-client.ts`)
- **Rust Files**: snake_case naming (e.g., `conversations.rs`)
- **File Size**: Max 200 lines per component/module
- **SQL Queries**: Parameterized (prepared statements)
- **HTML Content**: Sanitized via DOMPurify

## Success Metrics

- Chat UI responsive with <300ms message latency
- SQLite persistence without UI blocking
- Multi-provider routing without user friction
- Settings persistence across sessions
