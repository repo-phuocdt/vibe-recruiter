import type { Conversation, Message } from '$lib/types';
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  getMessages,
} from '$lib/services/tauri-commands';

let conversations = $state<Conversation[]>([]);
let activeConversationId = $state<string | null>(null);
let messages = $state<Message[]>([]);
let isLoadingConversations = $state(false);
let isLoadingMessages = $state(false);
let storeError = $state<string | null>(null);

let activeConversation = $derived(
  conversations.find((c) => c.id === activeConversationId) ?? null
);

export async function loadConversations(): Promise<void> {
  isLoadingConversations = true;
  storeError = null;
  try {
    conversations = await listConversations();
  } catch (err) {
    storeError = err instanceof Error ? err.message : 'Failed to load conversations';
  } finally {
    isLoadingConversations = false;
  }
}

export async function selectConversation(id: string): Promise<void> {
  activeConversationId = id;
  isLoadingMessages = true;
  storeError = null;
  try {
    messages = await getMessages(id);
  } catch (err) {
    storeError = err instanceof Error ? err.message : 'Failed to load messages';
    messages = [];
  } finally {
    isLoadingMessages = false;
  }
}

export async function createNewChat(title = 'New Chat'): Promise<Conversation | null> {
  storeError = null;
  try {
    const conv = await createConversation(title);
    conversations = [conv, ...conversations];
    activeConversationId = conv.id;
    messages = [];
    return conv;
  } catch (err) {
    storeError = err instanceof Error ? err.message : 'Failed to create conversation';
    return null;
  }
}

export async function deleteChat(id: string): Promise<void> {
  storeError = null;
  try {
    await deleteConversation(id);
    conversations = conversations.filter((c) => c.id !== id);
    if (activeConversationId === id) {
      activeConversationId = conversations[0]?.id ?? null;
      messages = activeConversationId ? await getMessages(activeConversationId) : [];
    }
  } catch (err) {
    storeError = err instanceof Error ? err.message : 'Failed to delete conversation';
  }
}

export async function renameChat(id: string, title: string): Promise<void> {
  storeError = null;
  try {
    await renameConversation(id, title);
    conversations = conversations.map((c) =>
      c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c
    );
  } catch (err) {
    storeError = err instanceof Error ? err.message : 'Failed to rename conversation';
  }
}

export function setMessages(msgs: Message[]): void {
  messages = msgs;
}

export const chatStore = {
  get conversations() { return conversations; },
  get activeConversationId() { return activeConversationId; },
  get activeConversation() { return activeConversation; },
  get messages() { return messages; },
  get isLoadingConversations() { return isLoadingConversations; },
  get isLoadingMessages() { return isLoadingMessages; },
  get error() { return storeError; },
};
