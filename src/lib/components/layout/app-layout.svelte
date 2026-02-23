<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Conversation } from '$lib/types.js';
  import Sidebar from './sidebar.svelte';

  let {
    children,
    conversations,
    activeId,
    oncreate,
    onselect,
    ondelete,
  }: {
    children: Snippet;
    conversations: Conversation[];
    activeId: string | null;
    oncreate: () => void;
    onselect: (id: string) => void;
    ondelete: (id: string) => void;
  } = $props();
</script>

<div class="flex h-screen bg-zinc-900 text-zinc-100">
  <Sidebar {conversations} {activeId} {oncreate} {onselect} {ondelete} />
  <main class="flex flex-1 flex-col overflow-hidden">
    {@render children()}
  </main>
</div>
