import type { Job } from '$lib/types';
import * as cmd from '$lib/services/tauri-commands';

let jobs = $state<Job[]>([]);
let loading = $state(false);
let storeError = $state<string | null>(null);

export async function loadJobs(statusFilter?: string): Promise<void> {
  loading = true;
  storeError = null;
  try {
    jobs = await cmd.listJobs(statusFilter);
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to load jobs';
  } finally {
    loading = false;
  }
}

export async function addJob(
  title: string,
  description?: string,
  requirements?: string
): Promise<Job | null> {
  try {
    const j = await cmd.createJob(title, description, requirements);
    jobs = [j, ...jobs];
    return j;
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to create job';
    return null;
  }
}

export async function removeJob(id: string): Promise<void> {
  try {
    await cmd.deleteJob(id);
    jobs = jobs.filter((j) => j.id !== id);
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to delete job';
  }
}

export const jobsStore = {
  get jobs() {
    return jobs;
  },
  get loading() {
    return loading;
  },
  get error() {
    return storeError;
  },
};
