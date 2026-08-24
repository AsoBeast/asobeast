import { TEST_AUTH_SECRET } from '../helpers/auth-env';

process.env.DATABASE_URL ??=
  'postgresql://asobeast:asobeast@localhost:5433/asobeast_bench';
process.env.PIPELINE_REDIS_DB ??= '3';
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.BILLING_ENABLED = 'false';

if (!process.env.DATABASE_URL.split('?')[0].endsWith('_bench')) {
  throw new Error(
    'The load benchmark writes large fixtures, so DATABASE_URL must name a database ending in _bench.',
  );
}
