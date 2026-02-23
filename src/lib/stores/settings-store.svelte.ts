import type { Settings } from '$lib/types';

const STORAGE_KEY = 'vibe-recruiter-settings';

const defaults: Settings = {
  model: 'gpt-4o',
  theme: 'dark',
  proxy_url: 'http://localhost:8787',
  proxy_api_key: '',
  ollama_url: 'http://localhost:11434',
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) } as Settings;
  } catch {
    return { ...defaults };
  }
}

function saveToStorage(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable (e.g. SSR context) — silently ignore
  }
}

let settings = $state<Settings>(loadFromStorage());

export function updateSettings(partial: Partial<Settings>): void {
  settings = { ...settings, ...partial };
  saveToStorage(settings);
}

export function resetSettings(): void {
  settings = { ...defaults };
  saveToStorage(settings);
}

export const settingsStore = {
  get settings() { return settings; },
  get model() { return settings.model; },
  get theme() { return settings.theme; },
  get proxy_url() { return settings.proxy_url; },
  get ollama_url() { return settings.ollama_url; },
};
