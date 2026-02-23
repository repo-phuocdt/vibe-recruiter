<script lang="ts">
  import type { Conversation } from '$lib/types.js';
  import SidebarNav from './sidebar-nav.svelte';

  let {
    conversations,
    activeId,
    oncreate,
    onselect,
    ondelete,
    showChatList = false,
  }: {
    conversations: Conversation[];
    activeId: string | null;
    oncreate: () => void;
    onselect: (id: string) => void;
    ondelete: (id: string) => void;
    showChatList?: boolean;
  } = $props();
</script>

<aside class="flex w-[240px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
  <SidebarNav />

  {#if showChatList}
    <div class="border-t border-zinc-800 px-3 pt-3">
      <button
        onclick={oncreate}
        class="flex w-full items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New Chat
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-2 pb-3 pt-2">
      {#if conversations.length === 0}
        <p class="px-2 py-4 text-center text-xs text-zinc-600">No conversations yet</p>
      {:else}
        {#each conversations as convo (convo.id)}
          <div class="group relative mb-0.5">
            <button
              onclick={() => onselect(convo.id)}
              class="w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors
                {activeId === convo.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'}"
            >
              {convo.title}
            </button>
            <button
              onclick={(e) => { e.stopPropagation(); ondelete(convo.id); }}
              class="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              aria-label="Delete conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        {/each}
      {/if}
    </nav>
  {/if}
</aside>
