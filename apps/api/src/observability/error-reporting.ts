import type { NodeOptions } from '@sentry/nestjs';
import { apiVersion } from '../api-version';
import { secretLiteralsFrom } from '../config/secret-env';
import { scrubEvent } from './error-event';

const PRODUCTION = 'production';

const DATA_COLLECTION: NodeOptions['dataCollection'] = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
};

export interface ReportingGate {
  dsn?: string;
  nodeEnv?: string;
  billingEnabled: boolean;
}

export function reportingDsn(gate: ReportingGate): string | null {
  const dsn = gate.dsn?.trim();
  if (!dsn || gate.nodeEnv !== PRODUCTION || !gate.billingEnabled) return null;
  return dsn;
}

export function reportingOptions(
  env: NodeJS.ProcessEnv,
): NodeOptions | undefined {
  const dsn = reportingDsn({
    dsn: env.ERROR_TRACKING_DSN,
    nodeEnv: env.NODE_ENV,
    billingEnabled: env.BILLING_ENABLED === 'true',
  });
  if (!dsn) return undefined;

  const secrets = secretLiteralsFrom((key) => env[key]);
  return {
    dsn,
    environment: PRODUCTION,
    release: apiVersion(),
    dataCollection: DATA_COLLECTION,
    maxBreadcrumbs: 0,
    beforeSend: (event) => scrubEvent(event, secrets),
  };
}
