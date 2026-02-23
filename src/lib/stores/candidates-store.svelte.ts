import type { Candidate } from '$lib/types';
import * as cmd from '$lib/services/tauri-commands';

let candidates = $state<Candidate[]>([]);
let selected = $state<Candidate | null>(null);
let loading = $state(false);
let storeError = $state<string | null>(null);

export async function loadCandidates(search?: string): Promise<void> {
  loading = true;
  storeError = null;
  try {
    candidates = await cmd.listCandidates(search);
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to load candidates';
  } finally {
    loading = false;
  }
}

export async function addCandidate(
  name: string,
  email?: string,
  phone?: string
): Promise<Candidate | null> {
  try {
    const c = await cmd.createCandidate(name, email, phone);
    candidates = [c, ...candidates];
    return c;
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to create candidate';
    return null;
  }
}

export async function removeCandidate(id: string): Promise<void> {
  try {
    await cmd.deleteCandidate(id);
    candidates = candidates.filter((c) => c.id !== id);
    if (selected?.id === id) selected = null;
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to delete candidate';
  }
}

export async function selectCandidateById(id: string): Promise<void> {
  try {
    selected = await cmd.getCandidate(id);
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to load candidate';
  }
}

export function clearSelection(): void {
  selected = null;
}

export const candidatesStore = {
  get candidates() {
    return candidates;
  },
  get selected() {
    return selected;
  },
  get loading() {
    return loading;
  },
  get error() {
    return storeError;
  },
};
