<script lang="ts">
  import { Marked } from 'marked';
  import DOMPurify from 'dompurify';
  import type { Message } from '$lib/types.js';

  const parser = new Marked({ async: false });

  let { message }: { message: Message } = $props();

  let isUser = $derived(message.role === 'user');

  let htmlContent = $derived(
    DOMPurify.sanitize(parser.parse(message.content) as string)
  );
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'} mb-4 px-4">
  <div
    class="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
      {isUser
        ? 'bg-blue-600 text-white rounded-br-sm'
        : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'}"
  >
    {#if isUser}
      <p class="whitespace-pre-wrap">{message.content}</p>
    {:else}
      <div class="prose prose-invert prose-sm max-w-none">
        {@html htmlContent}
      </div>
    {/if}
  </div>
</div>
