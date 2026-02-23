<script lang="ts">
  import type { Message } from '$lib/types.js';
  import MessageList from './message-list.svelte';
  import ChatInput from './chat-input.svelte';

  let {
    messages,
    isLoading,
    onsend,
  }: {
    messages: Message[];
    isLoading: boolean;
    onsend: (input: string) => void;
  } = $props();
</script>

<div class="flex flex-1 flex-col overflow-hidden">
  {#if messages.length === 0 && !isLoading}
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <p class="text-lg font-medium text-zinc-400">Start a conversation</p>
        <p class="mt-1 text-sm text-zinc-600">Send a message to begin</p>
      </div>
    </div>
  {:else}
    <MessageList {messages} {isLoading} />
  {/if}

  <ChatInput {onsend} disabled={isLoading} />
</div>
