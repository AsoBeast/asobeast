import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { pino, type LogFn, type LoggerOptions } from 'pino';
import type { Env } from '../../config/env';
import { WorkspaceContext } from '../tenancy/workspace-context';
import { REDACTED, REDACTION_PATHS, scrubSecrets } from './log-redaction';

export const SECRET_ENV_KEYS = [
  'AUTH_SECRET',
  'OPENAI_API_KEY',
  'SMTP_PASSWORD',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PROXY_API_KEY',
  'PROXY_PASSWORD',
  'PROXY_RESIDENTIAL_PASSWORD',
] as const satisfies readonly (keyof Env)[];

const PINO_LEVEL: Record<Env['LOG_LEVEL'], LoggerOptions['level']> = {
  error: 'error',
  warn: 'warn',
  log: 'info',
  debug: 'debug',
  verbose: 'trace',
};

const QUIET_ROUTES = ['/health', '/metrics'];

export function secretLiterals(config: ConfigService<Env, true>): string[] {
  return SECRET_ENV_KEYS.map((key) => config.get(key, { infer: true })).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

export function pinoOptions(
  config: ConfigService<Env, true>,
  workspace: WorkspaceContext,
): LoggerOptions {
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const literals = secretLiterals(config);

  return {
    level:
      nodeEnv === 'test'
        ? 'silent'
        : PINO_LEVEL[config.get('LOG_LEVEL', { infer: true })],
    redact: { paths: REDACTION_PATHS, censor: REDACTED },
    mixin: () => tenantContext(workspace),
    hooks: {
      logMethod(args, method) {
        method.apply(
          this,
          args.map((arg) => scrubSecrets(arg, literals)) as Parameters<LogFn>,
        );
      },
    },
    transport:
      nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
  };
}

export function loggerParams(
  config: ConfigService<Env, true>,
  workspace: WorkspaceContext,
): Params {
  return {
    pinoHttp: {
      logger: pino(pinoOptions(config, workspace)),
      genReqId: () => workspace.correlationId ?? randomUUID(),
      autoLogging: {
        ignore: (request) => QUIET_ROUTES.includes(request.url ?? ''),
      },
    },
  };
}

function tenantContext(workspace: WorkspaceContext): Record<string, string> {
  const workspaceId = workspace.current;
  const correlationId = workspace.correlationId;
  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(correlationId ? { correlationId } : {}),
  };
}
