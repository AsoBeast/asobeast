import { config } from 'dotenv';
import { join } from 'path';
import { TEST_AUTH_SECRET } from '../helpers/auth-env';

config({ path: join(__dirname, '..', '.env.test'), override: true });
process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.BILLING_ENABLED = 'false';
process.env.REDIS_DB = process.env.ISOLATION_REDIS_DB ?? '3';
