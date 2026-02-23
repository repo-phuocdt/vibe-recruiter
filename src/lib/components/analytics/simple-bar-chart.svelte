<script lang="ts">
  let {
    data,
    title = '',
  }: {
    data: { label: string; value: number }[];
    title?: string;
  } = $props();

  const maxValue = $derived(Math.max(...data.map((d) => d.value), 1));
</script>

<div class="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
  {#if title}
    <h3 class="mb-3 text-sm font-medium text-zinc-300">{title}</h3>
  {/if}

  {#if data.length === 0}
    <p class="py-4 text-center text-xs text-zinc-500">No data</p>
  {:else}
    <div class="space-y-2">
      {#each data as item (item.label)}
        <div class="flex items-center gap-3">
          <span class="w-28 shrink-0 truncate text-right text-xs text-zinc-400" title={item.label}>
            {item.label}
          </span>
          <div class="relative h-5 flex-1 rounded bg-zinc-900">
            <div
              class="h-full rounded bg-blue-600/60"
              style="width: {(item.value / maxValue) * 100}%"
            ></div>
          </div>
          <span class="w-8 shrink-0 text-right text-xs font-medium text-zinc-300">
            {item.value}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>
