# AI SDK v6 API Research Report

**Package**: `ai@6.0.97` (installed) | **Date**: 2026-02-23

## TL;DR — Breaking Changes Affecting This Codebase

The codebase was written against v4 conventions. `ai@6` is v5 API renamed again. All 5 issues below are **currently broken or using deprecated patterns**.

---

## 1. `tool()` Function — `parameters` → `inputSchema`

**v4 (current codebase — WRONG for v6):**
```ts
import { tool } from 'ai';
import { z } from 'zod';

tool({
  description: 'Search candidates',
  parameters: z.object({ query: z.string() }),  // ❌ WRONG in v5/v6
  execute: async ({ query }) => { ... },
})
```

**v5/v6 (correct):**
```ts
import { tool } from 'ai';
import { z } from 'zod';

tool({
  description: 'Search candidates',
  inputSchema: z.object({ query: z.string() }),  // ✅ CORRECT
  execute: async ({ query }) => { ... },
})
```

**Affected files:**
- `src/lib/services/tools/search-candidates.ts` — line 9: `parameters:`
- `src/lib/services/tools/rank-candidates.ts` — line 9: `parameters:`
- `src/lib/services/tools/draft-email.ts` — line 8: `parameters:`
- `src/lib/services/tools/parse-cv.ts` — likely same
- `src/lib/services/tools/search-web.ts` — likely same
- `src/lib/services/tools/generate-report.ts` — likely same

**Zod version**: Project uses `zod@^4.3.6` — correct, v5/v6 requires zod v4.

---

## 2. `maxSteps` → `stopWhen` + `stepCountIs()`

**v4 (current codebase — WRONG for v6):**
```ts
streamText({
  model,
  tools,
  maxSteps: 10,  // ❌ REMOVED in v5/v6
})
```

**v5/v6 (correct):**
```ts
import { streamText, stepCountIs } from 'ai';

streamText({
  model,
  tools,
  stopWhen: stepCountIs(10),  // ✅ CORRECT
})
```

Default is `stepCountIs(1)` — without this, tools only run once (no agentic loop).

**Affected file**: `src/lib/services/agent.ts` line 54: `maxSteps: 10`

---

## 3. Message Types — `CoreMessage` → `ModelMessage`

**v4 (current — WRONG for v6):**
```ts
import type { CoreMessage } from 'ai';  // ❌ REMOVED in v5/v6
```

**v5/v6 (correct):**
```ts
import type { ModelMessage } from 'ai';  // ✅ CORRECT
import { convertToModelMessages } from 'ai';  // replaces convertToCoreMessages (now async)
```

`UIMessage` replaces the old `Message` type from `@ai-sdk/react` — not used in this codebase (uses custom `Message` type from `$lib/types`), so only `CoreMessage` import is the concern.

**Affected file**: `src/lib/services/agent.ts` line 2: `import type { CoreMessage } from 'ai'`

---

## 4. `toolCalls.args` / `toolResults.result` → `.input` / `.output`

**v4 (current — WRONG for v6):**
```ts
onStepFinish: ({ toolCalls, toolResults }) => {
  for (const tc of toolCalls) {
    tc.toolName   // still works
    tc.args       // ❌ RENAMED to .input in v5/v6
  }
  for (const tr of toolResults) {
    tr.result     // ❌ RENAMED to .output in v5/v6
  }
}
```

**v5/v6 (correct):**
```ts
onStepFinish: ({ toolCalls, toolResults }) => {
  for (const tc of toolCalls) {
    tc.toolName   // ✅
    tc.input      // ✅ was .args
  }
  for (const tr of toolResults) {
    tr.output     // ✅ was .result
  }
}
```

**Affected file**: `src/lib/services/agent.ts` lines 55–70 — uses `tc.args` and `tr.result`

---

## 5. `fullStream` Event Properties

`fullStream` is a valid property on the `streamText` result (despite docs being unclear — it's part of the return value). Event types:

```ts
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text':
      part.text  // string delta
      break;
    case 'tool-call':
      part.toolCallId  // string
      part.toolName    // string
      part.input       // object (was .args in v4)
      break;
    case 'tool-result':
      part.toolCallId  // string
      part.toolName    // string
      part.input       // object
      part.output      // any (was .result in v4)
      break;
    case 'tool-call-streaming-start':
    case 'tool-call-delta':
      // streaming partials
      break;
  }
}
```

The `textStream` (used in `chat-manager.ts`) is still valid — iterates only text deltas.

---

## Summary of Required Fixes

| File | Issue | Fix |
|------|-------|-----|
| `agent.ts` | `CoreMessage` import | → `ModelMessage` |
| `agent.ts` | `maxSteps: 10` | → `stopWhen: stepCountIs(10)` |
| `agent.ts` | `tc.args` | → `tc.input` |
| `agent.ts` | `tr.result` | → `tr.output` |
| All `tools/*.ts` | `parameters:` | → `inputSchema:` |

---

## Correct Complete Pattern (v6)

```ts
import { streamText, tool, stepCountIs } from 'ai';
import type { ModelMessage, LanguageModel } from 'ai';
import { z } from 'zod';  // must be zod v4

// Tool definition
const myTool = tool({
  description: 'Do something',
  inputSchema: z.object({         // NOT 'parameters'
    query: z.string(),
  }),
  execute: async ({ query }) => {
    return { result: 'data' };
  },
});

// streamText with agentic loop
const result = streamText({
  model,
  messages: messages as ModelMessage[],  // NOT CoreMessage
  tools: { myTool },
  stopWhen: stepCountIs(10),             // NOT maxSteps
  onStepFinish: ({ toolCalls, toolResults }) => {
    for (const tc of toolCalls) {
      console.log(tc.toolName, tc.input);   // NOT tc.args
    }
    for (const tr of toolResults) {
      console.log(tr.toolName, tr.output);  // NOT tr.result
    }
  },
});

// Consume stream
for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
```

---

## Unresolved Questions

1. Are `parameters` and `args`/`result` silently deprecated (still work) or hard errors? Docs say renamed but runtime behavior on `ai@6.0.97` with old names is unconfirmed — could be TypeScript-only errors that still run.
2. Is `CoreMessage` completely removed from exports or just deprecated? The import `type { CoreMessage }` in agent.ts may still compile if re-exported for compat.
3. `chat-manager.ts` passes `StreamMessage[]` (plain objects) to `runAgent` which types them as `ModelMessage[]` — this should work since `ModelMessage` is a union of `{ role: 'user'|'assistant'|'system', content: string|ContentPart[] }` but not confirmed against exact v6 type definition.

---

Sources:
- [AI SDK 4.x → 5.0 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0)
- [AI SDK 5.x → 6.0 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
- [streamText() Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [tool() Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool)
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6)
