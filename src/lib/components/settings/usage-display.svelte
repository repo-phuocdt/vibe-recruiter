<script lang="ts">
  import type { UsageStats } from '$lib/types';

  let { usage }: { usage: UsageStats | null } = $props();

  function pct(used: number, limit: number): number {
    return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  }

  function fmt(n: number): string {
    return n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);
  }

  const resetDate = $derived(
    usage
      ? new Date(usage.resetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null,
  );
</script>

{#if !usage}
  <p class="text-sm text-zinc-500">Usage data unavailable</p>
{:else}
  <div class="space-y-4">
    <div class="flex items-center justify-between text-xs text-zinc-400">
      <span>Plan: <span class="font-medium capitalize text-zinc-300">{usage.plan}</span></span>
      {#if resetDate}<span>Resets {resetDate}</span>{/if}
    </div>

    <!-- Requests -->
    <div>
      <div class="mb-1 flex justify-between text-xs text-zinc-400">
        <span>Requests</span>
        <span>{fmt(usage.requestCount)} / {fmt(usage.requestLimit)}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
        <div
          class="h-full rounded-full transition-all {pct(usage.requestCount, usage.requestLimit) >= 90
            ? 'bg-red-500'
            : 'bg-blue-500'}"
          style="width: {pct(usage.requestCount, usage.requestLimit)}%"
        ></div>
      </div>
    </div>

    <!-- Tokens -->
    <div>
      <div class="mb-1 flex justify-between text-xs text-zinc-400">
        <span>Tokens</span>
        <span>{fmt(usage.tokensUsed)} / {fmt(usage.tokenLimit)}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
        <div
          class="h-full rounded-full transition-all {pct(usage.tokensUsed, usage.tokenLimit) >= 90
            ? 'bg-red-500'
            : 'bg-emerald-500'}"
          style="width: {pct(usage.tokensUsed, usage.tokenLimit)}%"
        ></div>
      </div>
    </div>
  </div>
{/if}
