export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Settings {
  model: string;
  theme: 'light' | 'dark' | 'system';
  proxy_url: string;
  proxy_api_key: string;
  ollama_url: string;
}
