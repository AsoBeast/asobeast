import { z } from 'zod';
import { assertProductionSafety } from './production-safety';
import { TrustedProxyHops } from './trusted-proxy';

/**
 * Typed environment configuration.
 *
 * The app refuses to boot on invalid config: `ConfigModule.forRoot` runs
 * `validate` (see app.module.ts) which calls `EnvSchema.parse`, so a bad value
 * (for example `PORT=abc`) throws a clear error at startup. Numbers are coerced
 * from their string env representation.
 */
const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  z.string().optional(),
);

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://asobeast:asobeast@localhost:5433/asobeast'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6380),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  PORT: z.coerce.number().int().positive().default(4000),
  DEFAULT_COUNTRY: z.string().min(1).default('us'),
  CRON_DAILY: z.string().min(1).default('0 3 * * *'),
  CRON_SCORING: z.string().min(1).default('0 4 * * 0'),
  SCRAPE_ITUNES_RPM: z.coerce.number().int().positive().default(15),
  SCRAPE_GPLAY_RPM: z.coerce.number().int().positive().default(10),
  PROXY_PROVIDER: z.enum(['none', 'webshare']).default('none'),
  PROXY_API_URL: z.url().default('https://proxy.webshare.io/api/v2'),
  PROXY_API_KEY: optionalText,
  PROXY_USERNAME: optionalText,
  PROXY_PASSWORD: optionalText,
  PROXY_ENDPOINT_RPM: z.coerce.number().int().positive().default(15),
  PROXY_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  PROXY_WORKER_MAX_CONCURRENCY: z.coerce.number().int().positive().default(8),
  PROXY_RESIDENTIAL_URL: optionalText,
  PROXY_RESIDENTIAL_USERNAME: optionalText,
  PROXY_RESIDENTIAL_PASSWORD: optionalText,
  PROXY_RESIDENTIAL_MONTHLY_CAP_USD: z.coerce.number().min(0).default(0),
  PROXY_RESIDENTIAL_COST_PER_GB: z.coerce.number().min(0).default(3),
  PROXY_RESIDENTIAL_MB_PER_REQUEST: z.coerce.number().min(0).default(1.2),
  CRON_PROXY_SYNC: z.string().min(1).default('0 2 * * *'),
  SIGNUP_CAPACITY_MAX_UTILIZATION: z.coerce.number().min(0).max(1).default(0),
  ALERT_RANK_DROP_THRESHOLD: z.coerce.number().int().positive().default(5),
  ALERT_REVIEW_SCORE_MAX: z.coerce.number().int().min(1).max(4).default(2),
  ALERT_DELIVERY: z.enum(['batched', 'instant']).default('batched'),
  WEBHOOK_ALLOW_PRIVATE_TARGETS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RETENTION_ALERT_EVENTS_DAYS: z.coerce.number().int().min(0).default(30),
  RETENTION_RANKINGS_DAYS: z.coerce.number().int().min(0).default(365),
  RETENTION_SERP_DAYS: z.coerce.number().int().min(0).default(90),
  RETENTION_SNAPSHOTS_DAYS: z.coerce.number().int().min(0).default(180),
  RETENTION_CATEGORY_RANKS_DAYS: z.coerce.number().int().min(0).default(365),
  RETENTION_CHANGE_EVENTS_DAYS: z.coerce.number().int().min(0).default(0),
  RETENTION_DELIVERIES_DAYS: z.coerce.number().int().min(0).default(30),
  RETENTION_AUDIT_SCORES_DAYS: z.coerce.number().int().min(0).default(0),
  RETENTION_ACTIONS_DAYS: z.coerce.number().int().min(0).default(180),
  RETENTION_BILLING_EVENTS_DAYS: z.coerce.number().int().min(0).default(90),
  ACTIONS_MAX_OPEN_PER_APP: z.coerce.number().int().positive().default(20),
  ACTIONS_SNOOZE_MAX_DAYS: z.coerce.number().int().positive().default(90),
  ALERT_ACTIONS_MIN_PRIORITY: z
    .enum(['critical', 'high', 'medium', 'low'])
    .default('high'),
  WEB_PUBLIC_URL: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined,
    z
      .url({
        protocol: /^https?$/,
        error:
          'WEB_PUBLIC_URL must be the http or https origin the web app is served from, for example https://aso.example.com',
      })
      .optional(),
  ),
  CRON_RETENTION: z.string().min(1).default('0 5 * * *'),
  CRON_DIGEST: z.string().min(1).default('0 8 * * 1'),
  CRON_AUDIT: z.string().min(1).default('0 6 * * *'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  OPENAI_API_KEY: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined,
    z.string().optional(),
  ),
  AI_MODEL: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined,
    z.string().min(1).default('gpt-4o'),
  ),
  BULL_BOARD_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  API_DOCS: z.enum(['owner', 'public', 'off']).default('owner'),
  METRICS_CACHE_SECONDS: z.coerce.number().int().min(0).default(30),
  BACKUP_MAX_AGE_HOURS: z.coerce.number().int().min(0).default(0),
  DISK_BUDGET_BYTES: z.coerce.number().int().min(0).default(0),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_ALLOW_REGISTRATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AUTH_REGISTRATION_WORKSPACE: z.enum(['own', 'shared']).default('own'),
  AUTH_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  STRIPE_SECRET_KEY: optionalText,
  STRIPE_WEBHOOK_SECRET: optionalText,
  STRIPE_PORTAL_RETURN_URL: optionalText,
  STRIPE_PRICE_INDIE_MONTHLY: optionalText,
  STRIPE_PRICE_INDIE_YEARLY: optionalText,
  STRIPE_PRICE_ULTIMATE_MONTHLY: optionalText,
  STRIPE_PRICE_ULTIMATE_YEARLY: optionalText,
  CRON_BILLING_RECONCILE: z.string().min(1).default('0 7 * * *'),
  CRON_TRIAL_NOTICES: z.string().min(1).default('0 9 * * *'),
  BILLING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(7),
  TRUST_PROXY: TrustedProxyHops,
  ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().min(1).default(7),
  ERROR_TRACKING_DSN: optionalText,
  LOG_LEVEL: z
    .enum(['error', 'warn', 'log', 'debug', 'verbose'])
    .default('debug'),
});

export type Env = z.infer<typeof EnvSchema>;

/** Used as the `validate` hook in `ConfigModule.forRoot`. */
export function validateEnv(config: Record<string, unknown>): Env {
  if ('AUTH_ENABLED' in config) {
    throw new Error(
      'AUTH_ENABLED is no longer supported. Authentication is always enabled. Delete AUTH_ENABLED from your environment and set AUTH_SECRET.',
    );
  }
  const env = EnvSchema.parse(config);
  assertProductionSafety(env);
  return env;
}
