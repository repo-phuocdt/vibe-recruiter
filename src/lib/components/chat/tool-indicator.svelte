<script lang="ts">
  import type { ToolCallData } from '$lib/types.js';

  let { toolCall }: { toolCall: ToolCallData } = $props();

  let isComplete = $derived(toolCall.status === 'complete');
  let isError = $derived(toolCall.status === 'error');

  const toolLabels: Record<string, string> = {
    searchCandidates: 'Searching candidates',
    parseCv: 'Parsing CV',
    rankCandidates: 'Ranking candidates',
    draftEmail: 'Fetching candidate data',
    searchWeb: 'Searching the web',
    generateReport: 'Generating report',
  };

  let label = $derived(toolLabels[toolCall.toolName] ?? toolCall.toolName);
</script>

<div class="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400">
  {#if isComplete}
    <svg class="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  {:else if isError}
    <svg class="h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  {:else}
    <svg class="h-3.5 w-3.5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  {/if}
  <span>{label}</span>
</div>
