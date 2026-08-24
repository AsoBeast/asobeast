import { TEST_AUTH_SECRET } from '../helpers/auth-env';

const databaseName = process.env.DATABASE_URL?.split('?')[0];

if (!databaseName?.endsWith('_upgrade')) {
  throw new Error(
    'The upgrade drill specs require DATABASE_URL to name the drill database created by run-drill.sh.',
  );
}

process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.BILLING_ENABLED = 'false';
