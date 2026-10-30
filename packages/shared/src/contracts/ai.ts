export interface AiStatus {
  configured: boolean;
  model: string | null;
}

export const AI_PROVIDERS = ['openai', 'compatible'] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];
