import { config } from 'dotenv';
import { join } from 'path';
import { TEST_AUTH_SECRET } from './helpers/auth-env';
import { assertTestDatabase } from './helpers/test-database';

config({ path: join(__dirname, '.env.test'), override: true });
assertTestDatabase(process.env.DATABASE_URL);
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.BILLING_ENABLED = 'false';
