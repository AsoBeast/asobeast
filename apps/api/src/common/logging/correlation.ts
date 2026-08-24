import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';
const MAX_LENGTH = 64;
const PRINTABLE = /^[A-Za-z0-9._-]+$/;

export function correlationIdOf(headers: IncomingHttpHeaders): string {
  const supplied = headers[CORRELATION_HEADER] ?? headers[REQUEST_ID_HEADER];
  const value = Array.isArray(supplied) ? supplied[0] : supplied;
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_LENGTH &&
    PRINTABLE.test(value)
    ? value
    : randomUUID();
}
