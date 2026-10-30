import type { AiProvider } from '@asobeast/shared';

const OPENAI_DOMAIN = 'openai.com';

const isOpenAiHost = (hostname: string): boolean =>
  hostname === OPENAI_DOMAIN || hostname.endsWith(`.${OPENAI_DOMAIN}`);

export const aiProviderOf = (baseUrl: string | undefined): AiProvider =>
  baseUrl === undefined || isOpenAiHost(new URL(baseUrl).hostname)
    ? 'openai'
    : 'compatible';
