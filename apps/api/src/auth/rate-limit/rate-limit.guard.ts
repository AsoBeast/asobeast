import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env';
import { AbuseMonitor } from '../abuse/abuse-monitor.service';
import type { AccountUser, AuthenticatedRequest } from '../auth.types';
import { planScopeOf } from '../plan-limits';
import { rateClassOf, skipsRateLimit } from './rate-class';
import {
  applyRateHeaders,
  headersForRefusal,
  headersForUsage,
} from './rate-headers';
import { RateLimitExceededError } from './rate-limit.errors';
import {
  RequestRateLimiter,
  type RateRelease,
  type RateScope,
} from './request-rate.limiter';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RequestRateLimiter,
    private readonly config: ConfigService<Env, true>,
    private readonly abuse: AbuseMonitor,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request & AuthenticatedRequest>();
    if (!req.user || skipsRateLimit(this.reflector, context)) return true;

    const res = http.getResponse<Response>();
    const scope = this.scopeOf(req.user);
    const rateClass = rateClassOf(this.reflector, context, req.method);

    try {
      const release = await this.limiter.acquire(scope);
      if (release) releaseWhenSettled(res, release);

      const headers = headersForUsage(
        await this.limiter.consume(scope, rateClass),
      );
      if (headers) applyRateHeaders(res, headers);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        applyRateHeaders(res, headersForRefusal(error.detail));
        void this.abuse
          .recordRefusal({
            workspaceId: scope.workspaceId,
            method: req.method,
            route: routeOf(req),
            rateClass,
          })
          .catch(() => undefined);
      }
      throw error;
    }
    return true;
  }

  private scopeOf(user: AccountUser): RateScope {
    const metered = this.config.get('BILLING_ENABLED', { infer: true });
    const { plan, limits } = planScopeOf(metered, user.workspace, new Date());
    return { workspaceId: user.workspaceId, plan, limits };
  }
}

function routeOf(req: Request): string {
  const route = (req as { route?: { path?: unknown } }).route;
  return typeof route?.path === 'string' ? route.path : req.path;
}

function releaseWhenSettled(res: Response, release: RateRelease): void {
  let released = false;
  const settle = () => {
    if (released) return;
    released = true;
    void release();
  };
  res.once('finish', settle);
  res.once('close', settle);
}
