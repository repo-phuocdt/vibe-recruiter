<script lang="ts">
  import AppLayout from '$lib/components/layout/app-layout.svelte';
  import ChatPanel from '$lib/components/chat/chat-panel.svelte';
  import {
    chatStore,
    loadConversations,
    createNewChat,
    selectConversation,
    deleteChat,
    setMessages,
  } from '$lib/stores/chat-store.svelte';
  import { settingsStore } from '$lib/stores/settings-store.svelte';
  import { authStore } from '$lib/stores/auth-store.svelte';
  import { getProvider } from '$lib/services/ai-client';
  import { createChatManager } from '$lib/services/chat-manager.svelte';

  const chat = createChatManager(() =>
    getProvider(settingsStore.model, settingsStore.settings, authStore.accessToken)
  );

  $effect(() => {
    loadConversations();
  });

  async function handleCreate() {
    const conv = await createNewChat();
    if (conv) {
      chat.loadMessages([], conv.id);
    }
  }

  async function handleSelect(id: string) {
    await selectConversation(id);
    chat.loadMessages(chatStore.messages, id);
  }

  async function handleDelete(id: string) {
    await deleteChat(id);
    if (chatStore.activeConversationId) {
      chat.loadMessages(chatStore.messages, chatStore.activeConversationId);
    } else {
      chat.clear();
    }
  }

  async function handleSend(input: string) {
    if (!chatStore.activeConversationId) {
      const conv = await createNewChat(input.slice(0, 50));
      if (conv) chat.setConversationId(conv.id);
    }
    await chat.send(input);
    setMessages(chat.messages);
  }
</script>

<AppLayout
  conversations={chatStore.conversations}
  activeId={chatStore.activeConversationId}
  showChatList={true}
  oncreate={handleCreate}
  onselect={handleSelect}
  ondelete={handleDelete}
>
  <ChatPanel messages={chat.messages} isLoading={chat.isLoading} onsend={handleSend} />
</AppLayout>
