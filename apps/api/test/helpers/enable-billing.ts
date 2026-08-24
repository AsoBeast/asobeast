import { TEST_AUTH_SECRET } from './auth-env';

process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.AUTH_ALLOW_REGISTRATION = 'false';
process.env.BILLING_ENABLED = 'true';
process.env.TRIAL_DAYS = '7';
process.env.WEB_PUBLIC_URL = 'https://app.example.test';
