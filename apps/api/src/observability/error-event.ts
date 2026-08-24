import { scrubSecrets, scrubText } from '../common/logging/log-redaction';

export const MAX_STACK_FRAMES = 30;
const MAX_MESSAGE_LENGTH = 500;
const IDENTIFIER = /^(c[a-z0-9]{20,}|[0-9a-f-]{16,}|\d+)$/i;

export interface ErrorEventContext {
  secrets: readonly string[];
  environment: string;
  release: string;
  workspaceId?: string;
  correlationId?: string;
  method?: string;
  path?: string;
}

export interface ErrorEvent {
  event_id: string;
  timestamp: number;
  platform: 'node';
  level: 'error';
  environment: string;
  release: string;
  logger: string;
  exception: {
    values: [{ type: string; value: string; stacktrace: { frames: string[] } }];
  };
  tags: Record<string, string>;
  request?: { method: string; url: string };
}

export function maskRoute(path: string): string {
  const [route] = path.split('?');
  return route
    .split('/')
    .map((segment) => (IDENTIFIER.test(segment) ? ':id' : segment))
    .join('/');
}

export function errorEvent(
  error: unknown,
  context: ErrorEventContext,
  eventId: string,
  now: Date,
): ErrorEvent {
  const scrubbed = scrubSecrets(
    error instanceof Error ? error : new Error(String(error)),
    context.secrets,
  );

  return {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: 'node',
    level: 'error',
    environment: context.environment,
    release: context.release,
    logger: 'asobeast',
    exception: {
      values: [
        {
          type: scrubbed.name,
          value: scrubbed.message.slice(0, MAX_MESSAGE_LENGTH),
          stacktrace: { frames: frames(scrubbed, context.secrets) },
        },
      ],
    },
    tags: {
      ...(context.workspaceId ? { workspace: context.workspaceId } : {}),
      ...(context.correlationId ? { correlation: context.correlationId } : {}),
    },
    ...(context.method && context.path
      ? { request: { method: context.method, url: maskRoute(context.path) } }
      : {}),
  };
}

function frames(error: Error, secrets: readonly string[]): string[] {
  return (error.stack ?? '')
    .split('\n')
    .slice(1, MAX_STACK_FRAMES + 1)
    .map((frame) => scrubText(frame.trim(), secrets));
}
