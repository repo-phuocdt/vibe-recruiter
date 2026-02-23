# Vibe Recruiter

Desktop agentic AI chatbox for recruiters. Built with Tauri v2 + SvelteKit + Rust + CF Workers.

## Features

- Claude-style chat UI with streaming responses
- Multi-provider LLM support (OpenAI, Claude, Ollama)
- Conversation persistence (SQLite)
- CF Workers proxy with auth + rate limiting
- Dark theme, settings page

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build

# Frontend only
pnpm dev

# Typecheck
pnpm check
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Tauri v2 |
| Frontend | SvelteKit (Svelte 5) + Tailwind CSS v4 |
| AI | Vercel AI SDK (streamText) |
| Backend | Rust (rusqlite, uuid, chrono) |
| Proxy | Cloudflare Workers + Hono |

## Project Structure

```
src/                    # SvelteKit frontend
├── lib/
│   ├── components/     # Svelte 5 components
│   ├── services/       # AI client, chat manager, Tauri IPC
│   └── stores/         # Reactive state (chat, settings)
├── routes/             # Pages (chat, settings)
src-tauri/              # Rust backend
├── src/
│   ├── commands/       # Tauri commands (CRUD)
│   └── db/             # SQLite + migrations
proxy/                  # CF Workers proxy
├── src/                # Hono routes, auth, rate limiter
```
