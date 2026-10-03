import type { AiCompletion, AiTokenUsage } from './openai.client';

export const aiCompletion = (
  output: unknown,
  usage: AiTokenUsage | null = null,
): AiCompletion => ({ output, usage });
