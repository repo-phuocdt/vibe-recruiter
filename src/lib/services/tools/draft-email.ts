import { tool } from 'ai';
import { z } from 'zod';
import { getCandidate } from '../tauri-commands';

export const draftEmail = tool({
  description:
    'Fetch candidate data to draft a professional email. Returns candidate info — use it to compose the email in your response.',
  inputSchema: z.object({
    candidateId: z.string().describe('The candidate UUID'),
    type: z
      .enum(['outreach', 'rejection', 'offer'])
      .describe('Type of email to draft'),
    context: z
      .string()
      .describe('Additional context: job title, specific notes, tone preferences'),
  }),
  execute: async ({ candidateId, type, context }) => {
    try {
      const candidate = await getCandidate(candidateId);
      return {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        parsed_data: candidate.parsed_data
          ? JSON.parse(candidate.parsed_data)
          : null,
        email_type: type,
        context,
      };
    } catch (err) {
      return { error: String(err) };
    }
  },
});
