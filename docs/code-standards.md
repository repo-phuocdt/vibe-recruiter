# Code Standards - Vibe Recruiter

## File Naming Conventions

| Layer | Extension | Format | Example |
|-------|-----------|--------|---------|
| **Frontend Components** | `.svelte` | kebab-case | `chat-input.svelte` |
| **TypeScript Modules** | `.ts` | kebab-case | `ai-client.ts` |
| **TypeScript Types** | `.ts` | kebab-case | `types.ts` |
| **Rust Backend** | `.rs` | snake_case | `conversations.rs` |

## Svelte 5 Rune Patterns

### State Declaration
```typescript
// Reactive state
let messages = $state<Message[]>([]);
let isLoading = $state(false);

// Derived state (computed, memoized)
let activeConversation = $derived(
  conversations.find((c) => c.id === activeConversationId) ?? null
);

// Effects
let effect = $effect(() => {
  console.log('Messages changed:', messages.length);
});

// Tool call state tracking (Phase 3)
let toolCalls = $state<ToolCallData[]>([]);
let activeToolIndex = $state<number | null>(null);
```

### Props with Runes
```svelte
<script lang="ts">
  let { messages, isLoading, onsend } = $props();
</script>
```

### Component Export Pattern
Use rune-based exports for stores:
```typescript
let state = $state<T>(...);

export const myStore = {
  get value() { return state; },
  set value(v) { state = v; },
};
```

## TypeScript Standards

### Type Definitions
- Define domain types in `src/lib/types.ts`
- Use strict typing; avoid `any`
- Interfaces for objects, type unions for discriminated unions

### Service Layer Pattern
```typescript
// services/my-service.ts
export function doSomething(input: string): Promise<Result> {
  // Implementation
}
```

### Error Handling
- Use try-catch in services
- Propagate errors to UI layer
- Display user-friendly error messages in components

## Svelte Component Structure

### File Organization
1. Script block (imports, props, runes)
2. Markup (reactive bindings)
3. Styles (scoped, Tailwind classes)

### Component Template
```svelte
<script lang="ts">
  import { someFunction } from '$lib/services/some-service';

  let { prop1, prop2 } = $props();
  let state = $state(initialValue);

  async function handleClick() {
    // ...
  }
</script>

<div class="flex flex-col gap-4">
  <!-- content -->
</div>

<style></style>
```

## Rust Backend Standards

### Command Handlers
- Return `Result<T, AppError>` for all Tauri commands
- Parameterized queries (use `?` placeholders)
- Lock database mutex carefully; keep critical sections small

### Example Command
```rust
#[tauri::command]
pub fn my_command(
    param: String,
    state: State<DbState>,
) -> Result<ResponseType, AppError> {
    let conn = state.0.lock().unwrap();

    conn.execute(
        "INSERT INTO table (col) VALUES (?1)",
        params![param],
    )?;

    Ok(ResponseType { /* ... */ })
}
```

### Error Convention
Errors must implement `std::error::Error` and `serde::Serialize`. Use `thiserror` for custom error types.

## Styling Guidelines

### Tailwind CSS v4
- Use utility-first approach
- Prefer Tailwind classes over custom CSS
- Responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Dark mode: `dark:` prefix

### Common Patterns
```html
<!-- Flex layout -->
<div class="flex flex-col gap-4">

<!-- Grid layout -->
<div class="grid grid-cols-2 gap-4">

<!-- Responsive text -->
<p class="text-sm md:text-base lg:text-lg">

<!-- Dark mode -->
<div class="bg-white dark:bg-zinc-900 text-black dark:text-white">
```

## Database Standards

### SQLite Conventions
- Table names: plural, lowercase (e.g., `conversations`, `messages`)
- Column names: snake_case (e.g., `created_at`)
- Timestamps: RFC 3339 format (ISO 8601 with timezone)
- UUIDs: v4, stored as TEXT

### Query Patterns
```rust
// Always use parameterized queries
conn.execute(
    "INSERT INTO messages (id, content) VALUES (?1, ?2)",
    params![id, content],
)?;

// For selects with prepared statements
let mut stmt = conn.prepare("SELECT * FROM messages WHERE conversation_id = ?1")?;
let rows = stmt.query_map(params![conv_id], |row| {
    Ok(Message { /* ... */ })
})?;
```

## HTML Sanitization

### DOMPurify Usage
```typescript
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Convert markdown to HTML, then sanitize
const html = marked(markdownContent);
const clean = DOMPurify.sanitize(html);
```

## File Size Limits

**Maximum 200 lines per file** across all layers:

- Svelte components: 150-200 lines (including script, markup, styles)
- TypeScript modules: 150-200 lines per function/class
- Rust modules: 150-200 lines per public API surface
- Type files: No strict limit (types-only files can exceed)

**When approaching limit:**
1. Extract helper functions to separate modules
2. Split large components into sub-components
3. Move business logic to service layer
4. Create utility modules for repeated patterns

## Import Organization

### JavaScript/TypeScript
```typescript
// 1. External dependencies
import { something } from 'external-package';
import { createOpenAI } from '@ai-sdk/openai';

// 2. Local modules
import { myFunction } from '$lib/services/my-service';
import type { MyType } from '$lib/types';

// 3. Relative imports (rare in this structure)
import { helper } from './helper';
```

## Tool Definition Standards (Phase 3)

### Tool Structure
```typescript
import { z } from 'zod';

// Define Zod schema for input validation
const searchCandidatesSchema = z.object({
  query: z.string().describe('Search query (skills, experience, name)'),
  limit: z.number().optional().describe('Max results (default 10)'),
});

// Export tool with description & execute function
export const searchCandidates = {
  description: 'Search candidates by skills or experience',
  inputSchema: searchCandidatesSchema,
  execute: async (input: z.infer<typeof searchCandidatesSchema>) => {
    // Validate via Zod (done automatically by agent)
    // Call Tauri command
    const results = await invokeTauriCommand('rank_candidates', { ... });
    // Return formatted results
    return results;
  },
};
```

## Testing & Debugging

- Use browser DevTools for frontend debugging
- Use Rust's `dbg!()` macro for backend inspection
- Log important state transitions in stores
- Avoid logging sensitive data (API keys, auth tokens)
- Test tool input validation with Zod schemas before execution (Phase 3)

## AI SDK v6 API Changes (Phase 3)

### Tool Definition (AI SDK v6)
```typescript
// ✅ Use inputSchema instead of parameters
const toolDef = {
  description: 'Tool description',
  inputSchema: z.object({ param: z.string() }), // AI SDK v6
  execute: async (input) => { /* ... */ },
};

// ❌ Don't use parameters (AI SDK v5)
// const toolDef = {
//   parameters: z.object({ ... }), // Old API
// };
```

### Agent Loop Control (AI SDK v6)
```typescript
// ✅ Use stepCountIs for max steps
const result = streamText({
  model,
  tools: allTools,
  stopWhen: (state) => stepCountIs(10, state), // AI SDK v6
});

// ❌ Don't use maxSteps directly (varies by SDK version)
// const result = streamText({ ..., maxSteps: 10 }); // Old API
```

### Message Types (AI SDK v6)
```typescript
// ✅ Use ModelMessage for agent/streaming
import type { ModelMessage } from 'ai';
const messages: ModelMessage[] = [...];

// ❌ Don't use CoreMessage for agentic flows
// import type { CoreMessage } from 'ai'; // Use for non-agent flows
```

## Version Control

- Commit messages follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Don't commit `.env` or configuration files with secrets
- Keep commits focused on single feature/fix
- Phase 3 commits reference AI SDK v6+ tool calling capability
