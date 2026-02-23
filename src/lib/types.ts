export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCallData {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'calling' | 'complete' | 'error';
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: string | null;
  created_at: string;
}

export interface RankedCandidate {
  candidate: Candidate;
  similarity_score: number;
}

export interface Settings {
  model: string;
  theme: 'light' | 'dark' | 'system';
  proxy_url: string;
  proxy_api_key: string;
  ollama_url: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  resume_path: string | null;
  parsed_data: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  status: string;
  created_at: string;
}

export interface SearchResult {
  source_type: string;
  source_id: string;
  chunk_text: string;
  score: number;
}

// --- Dashboard & Analytics ---

export interface StageCount {
  stage: string;
  count: number;
}

export interface DashboardStats {
  total_candidates: number;
  active_jobs: number;
  total_applications: number;
  pipeline_counts: StageCount[];
  hired_count: number;
}

export interface PipelineCandidate {
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string | null;
  job_id: string;
  job_title: string;
  stage: string;
  created_at: string;
}

export interface AnalyticsData {
  candidates_per_job: { job_title: string; count: number }[];
  stage_distribution: StageCount[];
}

export type PipelineStage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

export const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'screening', 'interview', 'offer', 'hired', 'rejected',
];
