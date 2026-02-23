# Phase 3: Agent Tools

## Context Links
- [Plan](./plan.md) | [Phase 1](./phase-01-project-setup-core-chat.md) | [Phase 2](./phase-02-data-and-rag.md)
- [AI SDK Tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) | [generateText](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)

## Overview
**P1 | Complete | 2 weeks** -- Agent orchestrator voi Vercel AI SDK `streamText()`, 6 tool definitions (Zod), execute qua Tauri commands, tool call UI indicators.

## Requirements

### Functional
- Agent loop: user message -> LLM decide tool -> execute -> LLM continue (multi-step)
- 6 tools: `search_candidates`, `parse_cv`, `rank_candidates`, `draft_email`, `search_web`, `generate_report`
- Moi tool co Zod schema validation cho parameters + return type
- Tool execution goi Tauri commands (local ops) hoac proxy (external APIs)
- System prompt thiet ke cho recruiter context voi tool descriptions
- UI: tool call indicators (spinning), thinking states, expandable tool results

### Non-Functional
- Agent loop max 10 tool calls per turn (prevent infinite loops)
- Tool execution timeout: 30s per tool call
- Streaming partial responses giua cac tool calls

## Related Code Files

### Frontend - Agent Core
```
src/lib/services/agent.ts                          # Agent orchestrator (generateText loop)
src/lib/services/tools/search-candidates.ts        # Vector search tool definition
src/lib/services/tools/parse-cv.ts                 # CV parse trigger tool
src/lib/services/tools/rank-candidates.ts          # Candidate ranking tool
src/lib/services/tools/draft-email.ts              # Email drafting tool
src/lib/services/tools/search-web.ts               # Web search tool (via proxy)
src/lib/services/tools/generate-report.ts          # Report generation tool
src/lib/services/tools/index.ts                    # Tool registry export
```

### Frontend - UI Components
```
src/lib/components/chat/tool-indicator.svelte      # Tool call in-progress indicator
src/lib/components/chat/tool-result.svelte         # Expandable tool result display
src/lib/components/chat/message-bubble.svelte      # Extended: render tool calls inline
```

### Proxy (extend)
```
proxy/src/index.ts                                 # Add /v1/search route (web search)
```

## Implementation Steps

### Step 1: Tool Definitions (Zod Schemas)
1. Install: `pnpm add zod` (da co qua ai sdk, confirm)
2. Moi tool file export `{ definition, execute }`:
   ```ts
   // tools/search-candidates.ts
   import { z } from 'zod';
   import { tool } from 'ai';
   import { invoke } from '@tauri-apps/api/core';

   export const searchCandidates = tool({
     description: 'Search candidate database by skills, experience, or natural language query. Use when user asks to find candidates matching criteria.',
     parameters: z.object({
       query: z.string().describe('Search query: skills, job title, or description'),
       topK: z.number().default(5).describe('Number of results to return'),
     }),
     execute: async ({ query, topK }) => {
       const results = await invoke('search_similar', { query, topK });
       return results;
     },
   });
   ```
3. Tool definitions cho moi tool:

| Tool | Parameters | Execute |
|------|-----------|---------|
| `search_candidates` | `query: string, topK: number` | `invoke('search_similar')` |
| `parse_cv` | `candidateId: string` | `invoke('upload_and_parse_cv')` — resolve path from DB server-side, NO raw filePath from LLM |
| `rank_candidates` | `jobId: string, topK: number` | `invoke('rank_candidates')` — Rust pre-filters top-K by vector similarity, returns subset for LLM reasoning |
| `draft_email` | `candidateId: string, type: 'outreach'|'rejection'|'offer', context: string` | LLM generate email text (no Tauri, pure AI) |
| `search_web` | `query: string` | Fetch qua proxy `/v1/search` route |
| `generate_report` | `type: 'pipeline'|'candidate_summary', filters: object` | `invoke('generate_report_data')` + LLM format |

4. `tools/index.ts` — export all tools as record:
   ```ts
   export const allTools = { searchCandidates, parseCv, rankCandidates, draftEmail, searchWeb, generateReport };
   ```

### Step 2: Agent Orchestrator
<!-- Red Team: Use streamText instead of generateText — 2026-02-22 -->
1. Implement `agent.ts` voi `streamText` loop (NOT `generateText` — blocking call gây 20-40s silence):
   ```ts
   import { streamText } from 'ai';
   import { allTools } from './tools';
   import { getProvider } from './ai-client';

   export async function runAgent(params: {
     messages: Message[];
     model: string;
     onToolCall?: (toolName: string, args: any) => void;
     onToolResult?: (toolName: string, result: any) => void;
     onTextChunk?: (text: string) => void;
   }) {
     const provider = getProvider(params.model);
     const result = streamText({
       model: provider(params.model),
       system: RECRUITER_SYSTEM_PROMPT,
       messages: params.messages,
       tools: allTools,
       maxSteps: 10,
       onStepFinish: ({ toolCalls, toolResults }) => {
         toolCalls?.forEach(tc => params.onToolCall?.(tc.toolName, tc.args));
         toolResults?.forEach(tr => params.onToolResult?.(tr.toolName, tr.result));
       },
     });
     // Stream text chunks in real-time
     for await (const chunk of result.textStream) {
       params.onTextChunk?.(chunk);
     }
     return await result;
   }
   ```
2. `maxSteps: 10` gioi han so tool calls per turn
3. `streamText` provides per-token streaming BETWEEN tool calls — no silent gaps
<!-- Updated: Validation Session 1 - Proxy-side agent fallback confirmed -->
4. **FALLBACK (if AI SDK fails in webview)**: Move agent to proxy server:
   - Create `proxy/src/routes/agent.ts` — POST endpoint that runs `streamText` + tools server-side
   - Frontend sends messages to `/v1/agent/chat`, receives SSE stream
   - Tools execute on proxy (web search, LLM calls) or relay to Tauri commands via WebSocket
   - This is the confirmed fallback strategy — no Node.js sidecar

### Step 3: System Prompt Design
1. Define `RECRUITER_SYSTEM_PROMPT` trong `agent.ts` voi sections:
   - **Capabilities**: finding candidates, parsing CVs, ranking, drafting emails, web search, reports
   - **Guidelines**: always search DB before suggesting, explain ranking reasoning, professional tone, use tables
   - **Available Data**: local DB of candidates (parsed CVs), jobs, applications. Never fabricate data.

### Step 4: Rust Support Commands
1. `rank_candidates(job_id, candidate_ids)` trong `commands/candidates.rs`: load job requirements + candidate parsed_data, return `Vec<RankedCandidate>` cho LLM compare
2. `generate_report_data(type, filters)` command: aggregate data tu DB (pipeline stats, candidate summaries)

### Step 5: Web Search via Proxy
1. Add `POST /v1/search` route trong proxy: forward query to Serper.dev API (`SERPER_API_KEY` in env), return top 5 search results
2. `tools/search-web.ts` goi proxy route, return search snippets

### Step 6: Agent UI Components
1. `tool-indicator.svelte` — show spinner + tool name khi running, check icon khi complete
2. `tool-result.svelte` — shadcn `Collapsible` component, show JSON output khi expand
3. Extend `message-bubble.svelte`: render tool calls inline giua text blocks
4. `chat-panel.svelte`: switch giua `useChat` (simple) va `runAgent` (agent mode)

### Step 7: Wire Agent into Chat Flow
1. `chat-panel.svelte` `handleSend()`: add user msg -> `runAgent()` voi callbacks `onToolCall`/`onToolResult` de update UI -> add assistant response -> `invoke('save_message')` voi `toolCalls` JSON
2. Save `tool_calls` JSON trong messages table de re-render on conversation reload

## Todo List

- [x] Define Zod schemas for all 6 tools
- [x] Implement search_candidates tool (wraps invoke search_similar)
- [x] Implement parse_cv tool (wraps invoke upload_and_parse_cv)
- [x] Implement rank_candidates tool + Rust rank command
- [x] Implement draft_email tool (pure LLM generation)
- [x] Implement search_web tool + proxy /v1/search route
- [x] Implement generate_report tool + Rust data aggregation command
- [x] Create tools/index.ts registry
- [x] Build agent orchestrator (streamText + maxSteps)
- [x] Write recruiter system prompt
- [x] Build tool-indicator.svelte component
- [x] Build tool-result.svelte component (collapsible)
- [x] Extend message-bubble to render tool calls inline
- [x] Wire agent into chat-panel send flow
- [x] Add tool_calls column to messages table
- [x] Test multi-step agent chain: "find top 5 candidates for Senior React Developer"
- [x] Test agent handles tool errors gracefully
- [x] Test maxSteps limit prevents infinite loops

## Success Criteria
- Agent tu dong chon dung tool based on user query
- Multi-step chains hoat dong: search -> rank -> draft email trong 1 turn
- Tool indicators hien thi real-time khi tools execute
- Tool results expandable, show structured output
- Agent respects maxSteps limit (10)
- Tool errors handled gracefully (agent explains error, continues)
- Messages voi tool calls persist va re-render correctly

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| generateText ko support streaming giua tool calls | Dung `onStepFinish` callback de update UI after each step. Future: switch to `streamText` khi AI SDK ho tro |
| Agent loop hang hoac chay vo han | `maxSteps: 10` hard limit + 30s timeout per tool call |
| Tool call costs cao (moi step = 1 LLM call) | Show estimated cost warning cho complex queries. Cache tool results |
| LLM chon sai tool hoac pass wrong params | Detailed tool descriptions + Zod validation catch bad params. Log + retry once |
| `rank_candidates` quality phu thuoc parsed_data | Ensure Phase 2 parsing robust. Fallback: re-parse khi rank |
| Web search API rate limits | Cache search results 1h. Serper.dev free tier 2500 queries/mo |
