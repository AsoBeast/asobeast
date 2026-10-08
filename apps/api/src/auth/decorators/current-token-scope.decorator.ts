import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ApiTokenScope } from '@asobeast/shared';
import type { AuthenticatedRequest } from '../auth.types';

export const CurrentTokenScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiTokenScope | undefined =>
    context.switchToHttp().getRequest<Request & AuthenticatedRequest>()
      .tokenScope,
);
