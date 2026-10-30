import type { AiProvider } from '@asobeast/shared';
import type { AiClient } from './openai.client';

export const stubAiClient = (
  structured: AiClient['structured'],
  model = 'gpt-test',
  provider: AiProvider = 'openai',
): AiClient => ({ model, provider, structured });
