import { tool } from 'ai';
import { z } from 'zod';
import { settingsStore } from '$lib/stores/settings-store.svelte';

export const searchWeb = tool({
  description:
    'Search the web for information. Use for market research, company info, salary benchmarks, or any external data.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    const { proxy_url } = settingsStore;
    const apiKey = settingsStore.settings.proxy_api_key;
    if (!proxy_url || !apiKey) {
      return { error: 'Proxy not configured.' };
    }
    try {
      const resp = await fetch(`${proxy_url}/v1/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { error: `Search failed (${resp.status}): ${text}` };
      }
      return await resp.json();
    } catch (err) {
      return { error: String(err) };
    }
  },
});
