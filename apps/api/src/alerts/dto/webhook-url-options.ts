import { IsUrl } from 'class-validator';

export const WEBHOOK_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
  allow_underscores: true,
} satisfies Parameters<typeof IsUrl>[0];
