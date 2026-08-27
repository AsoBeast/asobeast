import type { ErrorEvent, RequestEventData } from '@sentry/nestjs';
import { scrubSecrets } from '../common/logging/log-redaction';

const IDENTIFIER = /^(c[a-z0-9]{20,}|[0-9a-f-]{16,}|\d+)$/i;

export function maskRoute(path: string): string {
  const [route] = path.split('?');
  return route
    .split('/')
    .map((segment) => (IDENTIFIER.test(segment) ? ':id' : segment))
    .join('/');
}

function maskedRequest(request: RequestEventData): RequestEventData {
  return {
    ...(request.method ? { method: request.method } : {}),
    ...(request.url ? { url: maskRoute(request.url) } : {}),
  };
}

export function scrubEvent(
  event: ErrorEvent,
  secrets: readonly string[],
): ErrorEvent {
  const scrubbed = scrubSecrets(event, secrets);
  if (scrubbed.request) scrubbed.request = maskedRequest(scrubbed.request);
  if (scrubbed.transaction) {
    scrubbed.transaction = maskRoute(scrubbed.transaction);
  }
  return scrubbed;
}
