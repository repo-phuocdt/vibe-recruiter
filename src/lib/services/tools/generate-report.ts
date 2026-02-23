import { tool } from 'ai';
import { z } from 'zod';
import { generateReportData } from '../tauri-commands';

export const generateReport = tool({
  description:
    'Generate recruitment data report. Returns raw data — format it in your response as a readable report with tables.',
  inputSchema: z.object({
    type: z
      .enum(['pipeline', 'candidate_summary'])
      .describe('Report type: pipeline stats or candidate summary'),
  }),
  execute: async ({ type }) => {
    try {
      return await generateReportData(type);
    } catch (err) {
      return { error: String(err) };
    }
  },
});
