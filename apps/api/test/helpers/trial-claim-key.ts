import { createHmac } from 'crypto';
import { TEST_AUTH_SECRET } from './auth-env';

const digest = (material: string): string =>
  createHmac('sha256', TEST_AUTH_SECRET).update(material).digest('base64url');

export const trialClaimKey = (mailbox: string): string =>
  digest(`trial-claim:${mailbox}`);

export const cardClaimKey = (fingerprint: string): string =>
  digest(`trial-claim:card:${fingerprint}`);
