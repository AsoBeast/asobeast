import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth.types';
import { readsOnly } from '../read-access';

@Injectable()
export class TokenScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    if (req.tokenScope !== 'read') return true;
    if (readsOnly(this.reflector, context, req.method)) return true;

    throw new ForbiddenException(
      'This token is read-only. Mint a token with the write scope to change anything.',
    );
  }
}
