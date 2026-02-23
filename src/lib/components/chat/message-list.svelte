<script lang="ts">
  import type { Message } from '$lib/types.js';
  import MessageBubble from './message-bubble.svelte';

  let { messages, isLoading }: { messages: Message[]; isLoading: boolean } = $props();

  let listEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    // Trigger on message changes or loading state
    void messages.length;
    void isLoading;
    if (listEl) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  });
</script>

<div bind:this={listEl} class="flex-1 overflow-y-auto py-4">
  {#each messages as message (message.id)}
    <MessageBubble {message} />
  {/each}

  {#if isLoading}
    <div class="flex justify-start mb-4 px-4">
      <div class="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-zinc-800 px-4 py-3">
        <span class="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style="animation-delay: 0ms"></span>
        <span class="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style="animation-delay: 150ms"></span>
        <span class="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style="animation-delay: 300ms"></span>
      </div>
    </div>
  {/if}
</div>
