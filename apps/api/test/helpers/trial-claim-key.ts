import { createHmac } from 'crypto';
import { TEST_AUTH_SECRET } from './auth-env';

export const trialClaimKey = (mailbox: string): string =>
  createHmac('sha256', TEST_AUTH_SECRET)
    .update(`trial-claim:${mailbox}`)
    .digest('base64url');
