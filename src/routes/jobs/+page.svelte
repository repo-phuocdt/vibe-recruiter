<script lang="ts">
  import AppLayout from '$lib/components/layout/app-layout.svelte';
  import JobList from '$lib/components/jobs/job-list.svelte';
  import {
    chatStore,
    loadConversations,
    createNewChat,
    selectConversation,
    deleteChat,
  } from '$lib/stores/chat-store.svelte';
  import { goto } from '$app/navigation';

  $effect(() => {
    loadConversations();
  });

  async function handleCreate() {
    await createNewChat();
    goto('/');
  }

  async function handleSelect(id: string) {
    await selectConversation(id);
    goto('/');
  }

  async function handleDelete(id: string) {
    await deleteChat(id);
  }
</script>

<AppLayout
  conversations={chatStore.conversations}
  activeId={chatStore.activeConversationId}
  oncreate={handleCreate}
  onselect={handleSelect}
  ondelete={handleDelete}
>
  <JobList />
</AppLayout>
