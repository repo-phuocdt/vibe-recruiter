import { streamText, stepCountIs } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { allTools } from './tools';
import type { ToolCallData } from '$lib/types';

const RECRUITER_SYSTEM_PROMPT = `You are Vibe Recruiter — an AI recruitment assistant with access to a local database of candidates, jobs, and applications.

## Capabilities
- **Search candidates**: Find candidates by skills, experience, or natural language query using vector similarity search.
- **Parse CVs**: Extract structured data (skills, experience, education) from uploaded PDF resumes.
- **Rank candidates**: Rank candidates for a specific job by relevance using vector similarity.
- **Draft emails**: Compose professional outreach, rejection, or offer emails for candidates.
- **Web search**: Search the internet for market data, company info, salary benchmarks, etc.
- **Generate reports**: Produce pipeline statistics or candidate summary reports.

## Guidelines
- Always search the database before suggesting candidates — never fabricate candidate data.
- When ranking candidates, explain your reasoning for each candidate's position.
- Use tables for structured data (candidate lists, comparisons, reports).
- Maintain a professional, helpful tone. Be concise but thorough.
- If a tool call fails, explain the error and suggest alternatives.
- For email drafting: after calling the draftEmail tool, use the returned candidate data to compose a polished email in your response.

## Available Data
- Local SQLite database with candidates (parsed CVs), jobs, and applications.
- Vector embeddings for semantic search across candidate and job data.
- All data is local — never fabricate information not in the database.`;

export interface AgentCallbacks {
  onToolCall?: (toolCall: ToolCallData) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
}

/**
 * Run the agent loop with streaming and tool calling.
 * Uses streamText with stopWhen for multi-step tool chains (up to 10 steps).
 */
export function runAgent(params: {
  messages: ModelMessage[];
  model: LanguageModel;
  callbacks?: AgentCallbacks;
  ragContext?: string;
}) {
  const systemPrompt = params.ragContext
    ? RECRUITER_SYSTEM_PROMPT + '\n\n' + params.ragContext
    : RECRUITER_SYSTEM_PROMPT;

  const result = streamText({
    model: params.model,
    system: systemPrompt,
    messages: params.messages,
    tools: allTools,
    stopWhen: stepCountIs(10),
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls) {
        for (const tc of toolCalls) {
          params.callbacks?.onToolCall?.({
            toolName: tc.toolName,
            args: tc.input as Record<string, unknown>,
            status: 'complete',
          });
        }
      }
      if (toolResults) {
        for (const tr of toolResults) {
          params.callbacks?.onToolResult?.(tr.toolName, tr.output);
        }
      }
    },
  });

  return result;
}
