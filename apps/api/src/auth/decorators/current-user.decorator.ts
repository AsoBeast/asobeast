import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    if (!req.user) throw new UnauthorizedException('Not authenticated');
    return req.user;
  },
);
