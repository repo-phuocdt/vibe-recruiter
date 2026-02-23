import type {
  Conversation, Message, Candidate, Job, SearchResult, RankedCandidate,
  DashboardStats, PipelineCandidate, AnalyticsData,
} from '$lib/types';

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
  content: string,
  toolCalls?: string | null
): Promise<Message> {
  return tauriInvoke<Message>('save_message', {
    conversationId,
    role,
    content,
    toolCalls: toolCalls ?? null,
  });
}

// --- Candidates ---

export async function createCandidate(
  name: string,
  email?: string,
  phone?: string
): Promise<Candidate> {
  return tauriInvoke<Candidate>('create_candidate', {
    name,
    email: email ?? null,
    phone: phone ?? null,
  });
}

export async function listCandidates(search?: string): Promise<Candidate[]> {
  return tauriInvoke<Candidate[]>('list_candidates', { search: search ?? null });
}

export async function getCandidate(id: string): Promise<Candidate> {
  return tauriInvoke<Candidate>('get_candidate', { id });
}

export async function updateCandidate(
  id: string,
  name?: string,
  email?: string,
  phone?: string
): Promise<void> {
  return tauriInvoke<void>('update_candidate', {
    id,
    name: name ?? null,
    email: email ?? null,
    phone: phone ?? null,
  });
}

export async function deleteCandidate(id: string): Promise<void> {
  return tauriInvoke<void>('delete_candidate', { id });
}

export async function uploadCv(candidateId: string, filePath: string): Promise<string> {
  return tauriInvoke<string>('upload_cv', { candidateId, filePath });
}

export async function processCv(
  candidateId: string,
  proxyUrl: string,
  apiKey: string
): Promise<string> {
  return tauriInvoke<string>('process_cv', { candidateId, proxyUrl, apiKey });
}

// --- Jobs ---

export async function createJob(
  title: string,
  description?: string,
  requirements?: string
): Promise<Job> {
  return tauriInvoke<Job>('create_job', {
    title,
    description: description ?? null,
    requirements: requirements ?? null,
  });
}

export async function listJobs(statusFilter?: string): Promise<Job[]> {
  return tauriInvoke<Job[]>('list_jobs', { statusFilter: statusFilter ?? null });
}

export async function getJob(id: string): Promise<Job> {
  return tauriInvoke<Job>('get_job', { id });
}

export async function updateJob(
  id: string,
  title?: string,
  description?: string,
  requirements?: string,
  status?: string
): Promise<void> {
  return tauriInvoke<void>('update_job', {
    id,
    title: title ?? null,
    description: description ?? null,
    requirements: requirements ?? null,
    status: status ?? null,
  });
}

export async function deleteJob(id: string): Promise<void> {
  return tauriInvoke<void>('delete_job', { id });
}

export async function embedJob(jobId: string, proxyUrl: string, apiKey: string): Promise<void> {
  return tauriInvoke<void>('embed_job', { jobId, proxyUrl, apiKey });
}

// --- Embeddings ---

export async function searchSimilar(
  query: string,
  topK: number,
  proxyUrl: string,
  apiKey: string
): Promise<SearchResult[]> {
  return tauriInvoke<SearchResult[]>('search_similar', { query, topK, proxyUrl, apiKey });
}

// --- Agent tools ---

export async function rankCandidates(
  jobId: string,
  topK: number,
  proxyUrl: string,
  apiKey: string
): Promise<RankedCandidate[]> {
  return tauriInvoke<RankedCandidate[]>('rank_candidates', { jobId, topK, proxyUrl, apiKey });
}

export async function generateReportData(
  reportType: string
): Promise<Record<string, unknown>> {
  return tauriInvoke<Record<string, unknown>>('generate_report_data', { reportType });
}

// --- Analytics / Dashboard ---

export async function getDashboardStats(): Promise<DashboardStats> {
  return tauriInvoke<DashboardStats>('get_dashboard_stats');
}

export async function getPipelineCandidates(stage?: string): Promise<PipelineCandidate[]> {
  return tauriInvoke<PipelineCandidate[]>('get_pipeline_candidates', {
    stage: stage ?? null,
  });
}

export async function updateCandidateStage(
  applicationId: string,
  newStage: string,
): Promise<void> {
  return tauriInvoke<void>('update_candidate_stage', { applicationId, newStage });
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  return tauriInvoke<AnalyticsData>('get_analytics_data');
}

export async function createApplication(
  candidateId: string,
  jobId: string,
): Promise<string> {
  return tauriInvoke<string>('create_application', { candidateId, jobId });
}

export async function getJobApplications(jobId: string): Promise<PipelineCandidate[]> {
  return tauriInvoke<PipelineCandidate[]>('get_job_applications', { jobId });
}

// --- Auth token store ---

export async function storeAuthToken(accessToken: string, refreshToken: string): Promise<void> {
  return tauriInvoke<void>('store_auth_token', { accessToken, refreshToken });
}

export async function getAuthToken(): Promise<{ access_token: string; refresh_token: string } | null> {
  return tauriInvoke<{ access_token: string; refresh_token: string } | null>('get_auth_token');
}

export async function clearAuthToken(): Promise<void> {
  return tauriInvoke<void>('clear_auth_token');
}
