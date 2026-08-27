import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { pino, type LogFn, type LoggerOptions } from 'pino';
import type { Env } from '../../config/env';
import { secretLiteralsFrom } from '../../config/secret-env';
import { WorkspaceContext } from '../tenancy/workspace-context';
import { REDACTED, REDACTION_PATHS, scrubSecrets } from './log-redaction';

const PINO_LEVEL: Record<Env['LOG_LEVEL'], LoggerOptions['level']> = {
  error: 'error',
  warn: 'warn',
  log: 'info',
  debug: 'debug',
  verbose: 'trace',
};

const QUIET_ROUTES = ['/health', '/metrics'];

export function secretLiterals(config: ConfigService<Env, true>): string[] {
  return secretLiteralsFrom((key) => config.get(key, { infer: true }));
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
