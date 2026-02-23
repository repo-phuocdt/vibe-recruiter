import type { Conversation, Message } from '$lib/types';

// Tauri invoke with graceful fallback when running in browser (dev mode)
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function createConversation(title: string): Promise<Conversation> {
  return tauriInvoke<Conversation>('create_conversation', { title });
}

export async function listConversations(): Promise<Conversation[]> {
  return tauriInvoke<Conversation[]>('list_conversations');
}

export async function renameConversation(id: string, title: string): Promise<void> {
  return tauriInvoke<void>('rename_conversation', { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  return tauriInvoke<void>('delete_conversation', { id });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return tauriInvoke<Message[]>('get_messages', { conversationId });
}

export async function saveMessage(
  conversationId: string,
  role: string,
  content: string
): Promise<Message> {
  return tauriInvoke<Message>('save_message', { conversationId, role, content });
}
