import { createOpenAI } from '@ai-sdk/openai';
import type { Settings } from '$lib/types';

/**
 * Returns a LanguageModel instance based on model name and settings.
 * All models route through the proxy as OpenAI-compatible (proxy handles
 * model-based routing to OpenAI/Anthropic). Ollama bypasses proxy directly.
 */
export function getProvider(model: string, settings: Settings) {
  if (model.startsWith('ollama:')) {
    return createOpenAI({
      baseURL: settings.ollama_url + '/v1',
      apiKey: 'ollama',
    })(model.replace('ollama:', ''));
  }

  // All proxy models use OpenAI-compatible format.
  // Proxy detects "claude" in model name and transforms to Anthropic format.
  return createOpenAI({
    baseURL: settings.proxy_url + '/v1',
    apiKey: settings.proxy_api_key,
  })(model);
}
