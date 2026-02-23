import { tool } from 'ai';
import { z } from 'zod';
import { rankCandidates as invokeRank } from '../tauri-commands';
import { settingsStore } from '$lib/stores/settings-store';

export const rankCandidates = tool({
  description:
    'Rank candidates for a specific job by vector similarity. Returns top-K candidates pre-filtered by relevance for LLM reasoning.',
  inputSchema: z.object({
    jobId: z.string().describe('The job UUID to rank candidates for'),
    topK: z.number().int().min(1).max(20).default(5).describe('Number of top candidates (1-20)'),
  }),
  execute: async ({ jobId, topK }) => {
    const { proxy_url } = settingsStore;
    const apiKey = settingsStore.settings.proxy_api_key;
    if (!proxy_url || !apiKey) {
      return { error: 'Proxy not configured.' };
    }
    try {
      return await invokeRank(jobId, topK, proxy_url, apiKey);
    } catch (err) {
      return { error: String(err) };
    }
  },
});
