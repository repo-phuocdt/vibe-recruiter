# Brainstorm: Vibe Recruiter - Agentic AI Chatbox for Recruiters

**Date:** 2026-02-22
**Status:** Agreed

---

## Problem Statement

Build **Vibe Recruiter** - desktop AI chatbox (Tauri) giúp recruiters tuyển dụng hiệu quả hơn với agentic AI capabilities: chat + RAG, multi-step agent, tool-use.

**Target:** Recruiter-focused startup product.

---

## Requirements

### Functional
- Chat interface (Claude-style) với AI assistant
- Dashboard tuyển dụng (pipeline, candidates, jobs)
- RAG trên data tuyển dụng (1K-10K documents)
- Agent tools: CV parser, email/calendar, web scraping, report generation
- Multi-provider LLM (OpenAI, Claude, Ollama, etc.)
- Proxy API keys qua server (user trả tiền cho app, không BYO-key)

### Non-Functional
- Local-first data storage (MVP), cloud sync sau
- Startup product quality UX
- Offline-capable cho data management (không cho AI chat)
- Cross-platform (macOS, Windows, Linux)

---

## Agreed Architecture

### High-Level

```
┌──────────────────────────────────────────────┐
│  Tauri Desktop App                           │
│  ┌────────────────────────────────────────┐  │
│  │  SvelteKit (SPA) + Vercel AI SDK       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │ Chat UI  │ │Dashboard │ │Settings│ │  │
│  │  │ (Claude  │ │(Pipeline │ │(LLM,   │ │  │
│  │  │  style)  │ │ Kanban)  │ │ API)   │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────────┘ │  │
│  │       │ AI SDK      │ Tauri invoke()   │  │
│  └───────┼─────────────┼─────────────────┘  │
│  ┌───────┴─────────────┴─────────────────┐  │
│  │  Tauri Rust Backend                    │  │
│  │  • SQLite + sqlite-vec (local DB+RAG)  │  │
│  │  • CV Parser (pdf-extract crate)       │  │
│  │  • File I/O (import/export)            │  │
│  │  • Tauri Secure Store (auth tokens)    │  │
│  └────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────┘
                    │ HTTPS
    ┌───────────────┴───────────────┐
    │  LLM Proxy Server             │
    │  (Cloudflare Workers + Hono)  │
    │  • Auth (JWT/session)         │
    │  • LLM API proxy              │
    │  • Rate limiting              │
    │  • Usage tracking/billing     │
    │  • API key vault              │
    ├───────────┬───────────────────┤
    │           │                   │
    ▼           ▼                   ▼
  OpenAI    Anthropic           Ollama*
  API       API                 (local)
```

*Ollama chạy local, không qua proxy.

### Tech Stack

| Layer | Tech | Lý do |
|-------|------|-------|
| **Desktop Shell** | Tauri v2 | Cross-platform, nhẹ, Rust backend mạnh |
| **Frontend** | SvelteKit (SPA mode) | Nhẹ, nhanh, ít boilerplate |
| **UI Components** | shadcn-svelte + Tailwind CSS | Production-ready, accessible |
| **AI SDK** | Vercel AI SDK (@ai-sdk/svelte) | Multi-provider, streaming, agent support |
| **Local DB** | SQLite (via rusqlite) | Zero-config, embedded, local-first |
| **Vector Search** | sqlite-vec | In-process vector search, không cần DB riêng |
| **CV Parsing** | pdf-extract / lopdf (Rust) | Native performance, no sidecar needed |
| **Proxy Server** | Cloudflare Workers + Hono | Serverless, rẻ, global edge |
| **Auth** | Better Auth hoặc custom JWT | Session-based auth cho proxy |
| **Billing** | Stripe (khi cần) | Standard cho SaaS billing |

### Agent Architecture

```
User Message
     │
     ▼
┌─────────────────────────┐
│  Agent Orchestrator (TS) │  ← Vercel AI SDK generateText()
│  ┌───────────────────┐  │
│  │ System Prompt      │  │  ← Recruiter context + available tools
│  │ + Conversation     │  │
│  │ + RAG Context      │  │  ← Retrieved from sqlite-vec
│  └───────────────────┘  │
│          │               │
│   ┌──────┴──────┐       │
│   │ Tool Router  │       │
│   └──────┬──────┘       │
│   ┌──────┼──────────┐   │
│   ▼      ▼          ▼   │
│ search  parse_cv  send  │  ← Tools invoke Tauri commands
│ _candidates       _email│
└────┬────────┬───────┬───┘
     │        │       │
     ▼        ▼       ▼
  sqlite-  Rust     SMTP
  vec      parser   service
```

**Tools (MVP):**
1. `search_candidates` - Vector search trong CV database
2. `parse_cv` - Parse PDF/DOCX CV, extract structured data
3. `rank_candidates` - So sánh candidates với JD requirements
4. `draft_email` - Soạn email tuyển dụng
5. `search_web` - Tìm kiếm thông tin candidate/company online
6. `generate_report` - Tạo báo cáo tuyển dụng

### Data Model (SQLite)

```sql
-- Core tables
candidates (id, name, email, phone, resume_path, parsed_data JSON, created_at)
jobs (id, title, description, requirements JSON, status, created_at)
applications (id, candidate_id, job_id, status, score, notes, created_at)

-- RAG
embeddings (id, source_type, source_id, chunk_text, embedding BLOB, created_at)

-- Chat
conversations (id, title, created_at)
messages (id, conversation_id, role, content, tool_calls JSON, created_at)

-- Settings
settings (key, value JSON)
```

---

## Key Design Decisions

### 1. Tại sao SPA mode thay vì SSR?
Tauri render webview locally, không cần SSR. SPA mode = simpler build, faster startup, static assets bundled.

### 2. Tại sao sqlite-vec thay vì Zvec?
sqlite-vec mature hơn, nhiều bindings, tích hợp trực tiếp vào SQLite queries. Zvec mới release (Feb 2026), chưa battle-tested.

### 3. Tại sao CF Workers cho proxy thay vì self-hosted?
Serverless = zero ops, auto-scale, global edge latency thấp. Pay-per-request rẻ cho startup (free tier 100K req/day).

### 4. Agent loop ở frontend hay backend?
Frontend (TS). Vì:
- Vercel AI SDK chạy được ở client
- Tool execution gọi Tauri commands (Rust) qua IPC
- Streaming response trực tiếp tới UI
- Không cần roundtrip qua server cho mỗi tool call

### 5. Tại sao không sidecar?
Single binary đơn giản hơn. Rust backend đủ mạnh cho file I/O, DB, parsing. AI SDK ở frontend đủ cho agent orchestration. Không cần thêm Node.js runtime.

---

## MVP Phasing

### Phase 1: Core Chat (2-3 weeks)
- Tauri + SvelteKit scaffold
- Chat UI (Claude-style)
- LLM proxy server (CF Workers)
- Multi-provider support (OpenAI, Claude)
- Basic conversation management

### Phase 2: Data & RAG (2-3 weeks)
- SQLite schema + Rust commands
- CV upload + parsing
- Embedding pipeline (via LLM proxy)
- Vector search (sqlite-vec)
- RAG-enhanced chat responses

### Phase 3: Agent Tools (2-3 weeks)
- Tool-use agent loop
- search_candidates tool
- rank_candidates tool
- draft_email tool
- Agent UI (tool execution indicators)

### Phase 4: Dashboard (2 weeks)
- Candidate pipeline (Kanban)
- Job management
- Application tracking
- Basic analytics/reports

### Phase 5: Polish & Launch (1-2 weeks)
- Settings page (LLM config, account)
- Auth + billing integration
- Auto-update (Tauri updater)
- Installer packaging (dmg, msi, deb)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI SDK client-side limitations | Agent loop có thể thiếu server-side features | Fallback: thêm Node.js sidecar nếu cần |
| sqlite-vec performance ở 10K docs | Slow search | Binary quantization + limit chunk size |
| CV parsing accuracy | Poor data extraction | Dùng LLM để post-process parsed text |
| CF Workers cold start | Latency spike | Pre-warm + caching headers |
| Tauri webview inconsistency | UI bugs cross-platform | Test trên cả 3 OS, dùng Webkit-compatible CSS |

---

## Success Metrics
- Chat response < 2s (first token)
- CV parse + index < 5s per document
- Candidate search < 500ms
- App startup < 3s
- Bundle size < 30MB

---

## References
- [Tauri v2 Sidecar Docs](https://v2.tauri.app/develop/sidecar/)
- [Graphone - Tauri + Svelte AI Agent](https://github.com/PriNova/graphone)
- [Local-First AI with Rust + Tauri](https://medium.com/@Musbell008/a-technical-blueprint-for-local-first-ai-with-rust-and-tauri-b9211352bc0e)
- [Vercel AI SDK SvelteKit](https://ai-sdk.dev/docs/getting-started/svelte)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [Zvec by Alibaba](https://www.marktechpost.com/2026/02/10/alibaba-open-sources-zvec-an-embedded-vector-database-bringing-sqlite-like-simplicity-and-high-performance-on-device-rag-to-edge-applications/)
- [SQLite RAG Guide](https://blog.sqlite.ai/building-a-rag-on-sqlite)
