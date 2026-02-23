<script lang="ts">
  import type { ToolCallData } from '$lib/types.js';

  let { toolCall }: { toolCall: ToolCallData } = $props();
  let expanded = $state(false);

  let resultText = $derived(
    toolCall.result != null
      ? JSON.stringify(toolCall.result, null, 2)
      : 'No result'
  );

  let truncated = $derived(
    resultText.length > 500
      ? resultText.slice(0, 500) + '\n...'
      : resultText
  );
</script>

<div class="mx-3 mb-2 rounded-lg border border-zinc-700 bg-zinc-800/50 text-xs">
  <button
    class="flex w-full items-center justify-between px-3 py-2 text-left text-zinc-300 hover:bg-zinc-700/50"
    onclick={() => (expanded = !expanded)}
  >
    <span class="font-medium">{toolCall.toolName}</span>
    <svg
      class="h-3.5 w-3.5 transition-transform {expanded ? 'rotate-180' : ''}"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if expanded}
    <div class="border-t border-zinc-700 px-3 py-2">
      <p class="mb-1 text-zinc-500">Args:</p>
      <pre class="mb-2 overflow-x-auto whitespace-pre-wrap text-zinc-400">{JSON.stringify(toolCall.args, null, 2)}</pre>
      <p class="mb-1 text-zinc-500">Result:</p>
      <pre class="overflow-x-auto whitespace-pre-wrap text-zinc-400">{truncated}</pre>
    </div>
  {/if}
</div>
