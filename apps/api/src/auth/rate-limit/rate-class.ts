import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { DEFAULT_RATE_CLASS, type RateClass } from '@asobeast/shared';
import { SPENDS_STORE_CAPACITY_KEY } from '../decorators/spends-store-capacity.decorator';
import { READ_METHODS } from '../read-access';

export const RATE_CLASS_KEY = 'rate:class';

export const SKIP_RATE_LIMIT_KEY = 'rate:skip';

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

export function skipsRateLimit(
  reflector: Reflector,
  context: ExecutionContext,
): boolean {
  return (
    reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}

export const RateLimitClass = (rateClass: RateClass) =>
  SetMetadata(RATE_CLASS_KEY, rateClass);

export function rateClassOf(
  reflector: Reflector,
  context: ExecutionContext,
  method: string,
): RateClass {
  const targets = [context.getHandler(), context.getClass()];
  if (
    reflector.getAllAndOverride<boolean>(SPENDS_STORE_CAPACITY_KEY, targets)
  ) {
    return 'store';
  }
  const declared = reflector.getAllAndOverride<RateClass>(
    RATE_CLASS_KEY,
    targets,
  );
  if (declared) return declared;
  return READ_METHODS.includes(method) ? DEFAULT_RATE_CLASS : 'write';
}
