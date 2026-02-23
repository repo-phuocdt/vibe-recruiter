import { tool } from 'ai';
import { z } from 'zod';
import { searchSimilar } from '../tauri-commands';
import { settingsStore } from '$lib/stores/settings-store';

export const searchCandidates = tool({
  description:
    'Search candidate database by skills, experience, or natural language query. Use when user asks to find candidates matching criteria.',
  inputSchema: z.object({
    query: z.string().describe('Search query: skills, job title, or description'),
    topK: z.number().int().min(1).max(20).default(5).describe('Number of results (1-20)'),
  }),
  execute: async ({ query, topK }) => {
    const { proxy_url } = settingsStore;
    const apiKey = settingsStore.settings.proxy_api_key;
    if (!proxy_url || !apiKey) {
      return { error: 'Proxy not configured. Set proxy URL and API key in settings.' };
    }
    try {
      return await searchSimilar(query, topK, proxy_url, apiKey);
    } catch (err) {
      return { error: String(err) };
    }
  },
});
