import type { AiClient } from './openai.client';

export const stubAiClient = (
  structured: AiClient['structured'],
  model = 'gpt-test',
): AiClient => ({ model, structured });
