import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

export const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export const READ_ONLY_KEY = 'auth:readOnly';

export const ReadOnlyEndpoint = () => SetMetadata(READ_ONLY_KEY, true);

export function readsOnly(
  reflector: Reflector,
  context: ExecutionContext,
  method: string,
): boolean {
  if (READ_METHODS.includes(method)) return true;
  return (
    reflector.getAllAndOverride<boolean>(READ_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}
