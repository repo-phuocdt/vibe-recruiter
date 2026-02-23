# Code Reviewer Agent Memory

## Project: Vibe Recruiter
- **Stack:** Tauri v2 + SvelteKit (SPA) + Vercel AI SDK + Rust backend + CF Workers proxy
- **Plan dir:** `/Users/er_macbook_306/Workspaces/tauri-app/plans/260222-1538-vibe-recruiter/`
- **Key arch:** Desktop app -> CF Workers proxy -> LLM APIs (OpenAI, Anthropic)
- **Svelte version:** 5.53+ (runes: $state, $derived, $effect, $props)
- **Marked version:** 17+ (parse() is async by default -- must use `marked.use({ async: false })`)

## Phase 1 Review (2026-02-23)
- Score: 7/10. Report: `plans/reports/code-reviewer-260222-1811-phase1-review.md`
- Top issues: timing-attack auth, hardcoded proxy-key, CSP disabled, marked async bug, no abort on streams
- Anthropic SSE format mismatch through OpenAI-compat proxy -- needs verification
- Rust commands all use `.unwrap()` on Mutex lock -- panic risk
- Zero test coverage
- Dual message state (chat-store + chat-manager) is fragile sync pattern

## Security Patterns to Watch
- CORS: Phase 1 restricts to tauri://localhost + localhost:1420 (improved from plan)
- Auth gap: Proxy uses static key `'proxy-key'` hardcoded in client bundle
- Timing attack: `token !== expectedKey` in auth-middleware.ts (no constant-time compare)
- CSP: Disabled (`null`) in tauri.conf.json despite @html usage
- Prompt injection: CV text and RAG chunks injected into LLM prompts without sanitization
- Path traversal: `parse_cv` tool accepts raw file paths from LLM agent
- PII at rest: Candidate data in plain SQLite, no encryption
- JWT: No refresh token rotation or revocation mechanism planned
- Role validation: save_message accepts arbitrary role strings, no DB CHECK constraint

## Recurring Code Anti-Patterns
- Security deferred to final phase (common startup mistake)
- Aspirational security claims in later phases contradict earlier implementation
- Enum values defined in prose but not enforced in type system
- Fire-and-forget persistence (.catch(console.error)) with no user feedback
- Dual state sources requiring manual sync (chat-store + chat-manager messages)
