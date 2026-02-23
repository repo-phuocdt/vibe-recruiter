import { tool } from 'ai';
import { z } from 'zod';
import { processCv } from '../tauri-commands';
import { settingsStore } from '$lib/stores/settings-store.svelte';

export const parseCv = tool({
  description:
    'Parse and extract structured data from a candidate CV/resume. Only accepts candidateId — the file path is resolved securely on the server side.',
  inputSchema: z.object({
    candidateId: z.string().describe('The candidate UUID whose CV to parse'),
  }),
  execute: async ({ candidateId }) => {
    const { proxy_url } = settingsStore;
    const apiKey = settingsStore.settings.proxy_api_key;
    if (!proxy_url || !apiKey) {
      return { error: 'Proxy not configured.' };
    }
    try {
      const parsed = await processCv(candidateId, proxy_url, apiKey);
      return JSON.parse(parsed);
    } catch (err) {
      return { error: String(err) };
    }
  },
});
