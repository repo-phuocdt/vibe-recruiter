import { streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type { Message } from '$lib/types';
import { saveMessage } from './tauri-commands';

type ChatRole = 'user' | 'assistant' | 'system';

interface StreamMessage {
  role: ChatRole;
  content: string;
}

/**
 * Creates a reactive chat manager wrapping streamText.
 * Replaces useChat — supports tools in future phases.
 * Call inside a Svelte component or module-level runes context.
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

    // Placeholder for streaming assistant response
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId ?? '',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    messages = [...messages, assistantMsg];
    const assistantIndex = messages.length - 1;

    try {
      const result = streamText({
        model: getModel(),
        messages: toStreamMessages(messages.slice(0, -1)), // exclude empty assistant placeholder
      });

      let fullContent = '';

      for await (const delta of result.textStream) {
        fullContent += delta;
        // Reactive update of the last assistant message
        messages = messages.map((m, i) =>
          i === assistantIndex ? { ...m, content: fullContent } : m
        );
      }

      // Persist to Tauri backend (fire-and-forget errors are swallowed to not break UI)
      if (conversationId) {
        await saveMessage(conversationId, 'user', input.trim()).catch(console.error);
        await saveMessage(conversationId, 'assistant', fullContent).catch(console.error);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error while streaming';
      // Remove the empty assistant placeholder on failure
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
