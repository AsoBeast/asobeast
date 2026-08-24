import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { AuthenticatedRequest } from '../auth.types';
import { EntitlementRequiredError } from '../auth.errors';
import { ALLOW_UNENTITLED_KEY } from '../decorators/allow-unentitled.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SPENDS_STORE_CAPACITY_KEY } from '../decorators/spends-store-capacity.decorator';
import { entitlementDetail, isEntitled } from '../entitlement';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.auth.billing) return true;
    if (this.flag(context, ALLOW_UNENTITLED_KEY)) return true;
    if (this.flag(context, IS_PUBLIC_KEY)) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const now = new Date();
    if (!req.user || isEntitled(req.user.workspace, now)) return true;
    if (this.stillReadable(req, context)) return true;

    throw new EntitlementRequiredError(
      entitlementDetail(req.user.workspace, now),
    );
  }

  private stillReadable(
    req: Request & AuthenticatedRequest,
    context: ExecutionContext,
  ): boolean {
    if (req.method !== 'GET' || req.credential !== 'session') return false;
    return !this.flag(context, SPENDS_STORE_CAPACITY_KEY);
  }

  private flag(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
