import { TEST_AUTH_SECRET } from './auth-env';

process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.AUTH_ALLOW_REGISTRATION = 'true';
process.env.BILLING_ENABLED = 'false';
