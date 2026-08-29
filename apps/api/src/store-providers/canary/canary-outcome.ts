import {
  ImplausibleResultError,
  StoreAppNotFoundError,
  StoreRequestError,
} from '../errors';
import { CanaryShapeError } from './canary-checks';

export const CANARY_OUTCOMES = [
  'ok',
  'broken',
  'unreachable',
  'target-missing',
] as const;

export type CanaryOutcome = (typeof CANARY_OUTCOMES)[number];

export const TRANSPORT_MESSAGES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'socket hang up',
  'timeout',
  'fetch failed',
  '429',
  '503',
] as const;

export function outcomeOfError(error: unknown): CanaryOutcome {
  if (error instanceof StoreAppNotFoundError) return 'target-missing';
  if (error instanceof CanaryShapeError) return 'broken';
  if (error instanceof ImplausibleResultError) return 'broken';
  if (error instanceof StoreRequestError && isTransport(error.causeMessage)) {
    return 'unreachable';
  }
  return 'broken';
}

function isTransport(causeMessage: string): boolean {
  const lowered = causeMessage.toLowerCase();
  return TRANSPORT_MESSAGES.some((marker) =>
    lowered.includes(marker.toLowerCase()),
  );
}
