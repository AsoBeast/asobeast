import { UnrecoverableError } from 'bullmq';
import {
  ImplausibleResultError,
  StoreAppNotFoundError,
} from '../store-providers/errors';

export function withoutRetry(error: unknown): unknown {
  return error instanceof ImplausibleResultError ||
    error instanceof StoreAppNotFoundError
    ? new UnrecoverableError(error.message)
    : error;
}
