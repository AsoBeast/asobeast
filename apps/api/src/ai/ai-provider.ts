import type { AiProvider } from '@asobeast/shared';

const OPENAI_DOMAIN = 'openai.com';

const isOpenAiHost = (hostname: string): boolean =>
  hostname === OPENAI_DOMAIN || hostname.endsWith(`.${OPENAI_DOMAIN}`);

export const aiProviderOf = (baseUrl: string | undefined): AiProvider =>
  baseUrl === undefined || isOpenAiHost(new URL(baseUrl).hostname)
    ? 'openai'
    : 'compatible';

export interface AiProviderWording {
  name: string;
  inSentence: string;
  key: string;
  account: string;
  modelHint: string;
}

export const AI_PROVIDER_WORDING: Record<AiProvider, AiProviderWording> = {
  openai: {
    name: 'OpenAI',
    inSentence: 'OpenAI',
    key: 'The OpenAI key',
    account: 'The OpenAI account',
    modelHint: 'Check AI_MODEL.',
  },
  compatible: {
    name: 'The AI provider',
    inSentence: 'the AI provider',
    key: 'The API key',
    account: 'The AI provider account',
    modelHint: 'Check AI_MODEL and OPENAI_BASE_URL.',
  },
};
