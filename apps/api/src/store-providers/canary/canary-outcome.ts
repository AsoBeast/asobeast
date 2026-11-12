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

export function outcomeOfError(error: unknown): CanaryOutcome {
  if (error instanceof StoreAppNotFoundError) return 'target-missing';
  if (error instanceof CanaryShapeError) return 'broken';
  if (error instanceof ImplausibleResultError) return 'broken';
  if (error instanceof StoreRequestError && error.unreachable) {
    return 'unreachable';
  }
  return 'broken';
}
