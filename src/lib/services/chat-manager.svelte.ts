import type { LanguageModel } from 'ai';
import type { Message, ToolCallData } from '$lib/types';
import { saveMessage } from './tauri-commands';
import { runAgent } from './agent';

type ChatRole = 'user' | 'assistant' | 'system';

interface StreamMessage {
  role: ChatRole;
  content: string;
}

/**
 * Creates a reactive chat manager with agent tool support.
 * Uses streamText + tools with maxSteps for multi-step agent loops.
 */
export function createChatManager(getModel: () => LanguageModel) {
  let messages = $state<Message[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let conversationId = $state<string | null>(null);

  function toStreamMessages(msgs: Message[]): StreamMessage[] {
    return msgs
      .filter((m): m is Message & { role: ChatRole } =>
        m.role === 'user' || m.role === 'assistant' || m.role === 'system'
      )
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function send(input: string): Promise<void> {
    if (!input.trim() || isLoading) return;

    error = null;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId ?? '',
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    messages = [...messages, userMsg];
    isLoading = true;

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId ?? '',
      role: 'assistant',
      content: '',
      tool_calls: null,
      created_at: new Date().toISOString(),
    };

    messages = [...messages, assistantMsg];
    const assistantIndex = messages.length - 1;

    // Track tool calls for this response
    const collectedToolCalls: ToolCallData[] = [];

    try {
      // RAG context
      let ragContext: string | undefined;
      try {
        const { getRAGContext } = await import('./rag');
        const ctx = await getRAGContext(input.trim());
        if (ctx) ragContext = ctx;
      } catch {
        // RAG not available
      }

      const result = runAgent({
        messages: toStreamMessages(messages.slice(0, -1)),
        model: getModel(),
        ragContext,
        callbacks: {
          onToolCall: (tc) => {
            collectedToolCalls.push(tc);
            messages = messages.map((m, i) =>
              i === assistantIndex
                ? { ...m, tool_calls: JSON.stringify(collectedToolCalls) }
                : m
            );
          },
          onToolResult: (toolName, result) => {
            const idx = collectedToolCalls.findLastIndex(
              (tc) => tc.toolName === toolName
            );
            if (idx >= 0) {
              collectedToolCalls[idx].result = result;
              collectedToolCalls[idx].status = 'complete';
            }
            messages = messages.map((m, i) =>
              i === assistantIndex
                ? { ...m, tool_calls: JSON.stringify(collectedToolCalls) }
                : m
            );
          },
        },
      });

      let fullContent = '';

      for await (const delta of result.textStream) {
        fullContent += delta;
        messages = messages.map((m, i) =>
          i === assistantIndex ? { ...m, content: fullContent } : m
        );
      }

      // Persist messages
      const toolCallsJson =
        collectedToolCalls.length > 0
          ? JSON.stringify(collectedToolCalls)
          : null;

      if (conversationId) {
        saveMessage(conversationId, 'user', input.trim()).catch(console.error);
        saveMessage(conversationId, 'assistant', fullContent, toolCallsJson).catch(
          console.error
        );
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error while streaming';
      messages = messages.filter((_, i) => i !== assistantIndex);
    } finally {
      isLoading = false;
    }
  }

  function loadMessages(msgs: Message[], convId: string): void {
    messages = msgs;
    conversationId = convId;
    error = null;
  }

  function clear(): void {
    messages = [];
    error = null;
    conversationId = null;
  }

  function setConversationId(id: string): void {
    conversationId = id;
  }

  return {
    get messages() { return messages; },
    get isLoading() { return isLoading; },
    get error() { return error; },
    get conversationId() { return conversationId; },
    send,
    loadMessages,
    clear,
    setConversationId,
  };
}
