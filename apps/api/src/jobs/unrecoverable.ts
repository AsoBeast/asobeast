import { UnrecoverableError } from 'bullmq';
import { ImplausibleResultError } from '../store-providers/errors';

export function withoutRetry(error: unknown): unknown {
  return error instanceof ImplausibleResultError
    ? new UnrecoverableError(error.message)
    : error;
}
