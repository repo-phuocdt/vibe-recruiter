---
title: "Vibe Recruiter - Agentic AI Chatbox"
description: "Desktop AI chatbox (Tauri) for recruiters with RAG, agent tools, multi-provider LLM"
status: pending
priority: P1
effort: 12w
tags: [tauri, svelte, ai, rust, full-stack, startup]
created: 2026-02-22
---

# Vibe Recruiter - Implementation Plan

## Overview

Build **Vibe Recruiter** - desktop agentic AI chatbox for recruiters using Tauri v2 + SvelteKit + Vercel AI SDK. Chat UI Claude-style, recruitment dashboard, RAG trên CV/JD data, agent tools (parse CV, rank candidates, draft emails).

## Architecture

```
Tauri Desktop App
├── SvelteKit SPA (frontend) + Vercel AI SDK
│   ├── Chat UI (Claude-style)
│   ├── Dashboard (Kanban pipeline)
│   └── Settings
├── Rust Backend (Tauri commands)
│   ├── SQLite + sqlite-vec (local DB + RAG)
│   ├── CV Parser (pdf-extract)
│   └── File I/O
└── LLM Proxy (CF Workers + Hono)
    ├── Auth + rate limiting
    ├── Multi-provider proxy (OpenAI, Claude)
    └── Usage tracking
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Project Setup & Core Chat | Complete | 3w | [phase-01](./phase-01-project-setup-core-chat.md) |
| 2 | Data Management & RAG | Pending | 3w | [phase-02](./phase-02-data-and-rag.md) |
| 3 | Agent Tools | Pending | 2w | [phase-03](./phase-03-agent-tools.md) |
| 4 | Dashboard | Pending | 2w | [phase-04](./phase-04-dashboard.md) |
| 5 | Polish & Launch | Pending | 2w | [phase-05](./phase-05-polish-and-launch.md) |

## Key Dependencies

- Tauri v2 stable (released)
- Vercel AI SDK v4+ with SvelteKit support
- sqlite-vec extension (cross-platform builds)
- Cloudflare Workers account

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Tauri v2 |
| Frontend | SvelteKit (SPA) + Tailwind CSS + shadcn-svelte |
| AI | Vercel AI SDK (@ai-sdk/svelte) |
| Backend | Rust (rusqlite, pdf-extract, reqwest) |
| Vector DB | sqlite-vec |
| Proxy | Cloudflare Workers + Hono |
| Auth | Custom JWT |

## Red Team Review

### Session — 2026-02-22
**Findings:** 12 (12 accepted, 0 rejected)
**Severity breakdown:** 3 Critical, 5 High, 4 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | AI SDK `generateText` may not work client-side | Critical | Accept | Phase 1, 3 |
| 2 | Proxy unauthenticated during dev | Critical | Accept | Phase 1 |
| 3 | sqlite-vec build/bundle unaddressed | Critical | Accept | Phase 2 |
| 4 | Prompt injection via CV/RAG content | High | Accept | Phase 2 |
| 5 | `parse_cv` path traversal via filePath | High | Accept | Phase 3 |
| 6 | `generateText` non-streaming UX | High | Accept | Phase 3 |
| 7 | Embedding dimension hardcoded 1536 | High | Accept | Phase 2 |
| 8 | No migration framework | High | Accept | Phase 1 |
| 9 | No enum validation on pipeline stages | Medium | Accept | Phase 4 |
| 10 | PII unencrypted in SQLite | Medium | Accept | Phase 2 |
| 11 | `rank_candidates` loads all data | Medium | Accept | Phase 3 |
| 12 | No offline degradation model | Medium | Accept | Phase 5 |

## Validation Log

### Session 1 — 2026-02-22
**Trigger:** Initial plan creation + post-red-team validation
**Questions asked:** 6

#### Questions & Answers

1. **[Architecture]** AI SDK Fallback: Nếu Vercel AI SDK (`streamText`/`generateText`) KHÔNG chạy được trong Tauri webview, bạn muốn fallback thế nào?
   - Options: Proxy-side agent | Node.js sidecar | Verify first, decide later
   - **Answer:** Proxy-side agent
   - **Rationale:** Move agent logic to CF Workers if client-side fails. Frontend chỉ dùng fetch/useChat gọi proxy. Simplifies frontend, centralizes AI logic.

2. **[Security]** PII Encryption: Red team yêu cầu encrypt PII trong SQLite. Approach nào cho MVP?
   - Options: SQLCipher (whole DB) | Field-level encryption | Defer to post-MVP
   - **Answer:** SQLCipher (whole DB)
   - **Rationale:** Transparent encryption strongest approach. Requires `rusqlite` with `bundled-sqlcipher` feature. User provides unlock password on app start.

3. **[Scope]** Ollama local support có trong MVP không?
   - Options: Có, thêm vào Phase 1 | Không, post-MVP | MVP nhưng Phase 5
   - **Answer:** Có, thêm vào Phase 1
   - **Rationale:** AI SDK supports Ollama via `@ai-sdk/openai` with custom baseURL. Minimal extra work. Settings page allows Ollama URL input.

4. **[Architecture]** Chat architecture: Phase 1 dùng `useChat`, Phase 3 thêm `streamText` agent. Unify?
   - Options: Unify streamText only | Keep dual | useChat only, tools on proxy
   - **Answer:** Unify: streamText only
   - **Rationale:** Single architecture from day 1. Skip `useChat`, build custom state manager wrapping `streamText`. Tools enabled/disabled via flag. Prevents dual-mode complexity in Phase 3.

5. **[Scope]** CI/CD: Setup CI khi nào?
   - Options: Phase 1 | Phase 5 | Không cần
   - **Answer:** Phase 1
   - **Rationale:** GitHub Actions basic (lint + typecheck + build) catches errors early. Cross-platform build matrix added Phase 5.

6. **[Architecture]** CF Workers D1: Khi nào define schema?
   - Options: Phase 1 cùng proxy setup | Phase 5 khi implement auth
   - **Answer:** Phase 1 cùng proxy setup
   - **Rationale:** Define D1 users table early. Auth endpoints (Phase 5) just use existing schema. Avoids proxy redesign later.

#### Confirmed Decisions
- AI SDK fallback: proxy-side agent — centralizes AI, simplifies frontend
- PII: SQLCipher whole-DB encryption — strongest, transparent
- Ollama: MVP Phase 1 — minimal effort via AI SDK
- Chat arch: unified streamText — one architecture throughout
- CI/CD: Phase 1 — catch errors early
- D1: Phase 1 — schema ready for auth

#### Action Items
- [ ] Phase 1: Replace `useChat` with custom `streamText` wrapper + state manager
- [ ] Phase 1: Add Ollama provider option in ai-client.ts + settings
- [ ] Phase 1: Add GitHub Actions workflow (lint, typecheck, build)
- [ ] Phase 1: Add D1 users table schema in proxy setup
- [ ] Phase 2: Use `bundled-sqlcipher` feature for rusqlite
- [ ] Phase 3: Document proxy-side agent fallback architecture

#### Impact on Phases
- Phase 1: Major — unified streamText, Ollama support, CI/CD, D1 schema
- Phase 2: Medium — sqlcipher replaces plain rusqlite
- Phase 3: Medium — streamText already chosen, add proxy fallback docs

## References

- [Brainstorm Report](../reports/brainstorm-260222-1538-vibe-recruiter-architecture.md)
- [Tauri v2 Docs](https://v2.tauri.app/)
- [Vercel AI SDK SvelteKit](https://ai-sdk.dev/docs/getting-started/svelte)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [Graphone Reference](https://github.com/PriNova/graphone)
