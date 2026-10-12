import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE } from '@asobeast/shared';
import { WorkspaceContext } from '../../common/tenancy/workspace-context';
import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../auth.types';
import { apiToken } from '../bearer-token';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CredentialRateLimiter } from '../rate-limit/credential-rate.limiter';
import { addressTrackerOf } from '../rate-limit/request-tracker';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly workspace: WorkspaceContext,
    private readonly credentials: CredentialRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const claims = await this.auth.verifySession(cookies?.[SESSION_COOKIE]);
    const session = claims && (await this.auth.userOfSession(claims));
    const token = session
      ? null
      : await this.auth.resolveToken(req.headers.authorization);
    const user = session ?? token?.user;
    if (!user) {
      const lookedUp = Boolean(claims || apiToken(req.headers.authorization));
      const address = addressTrackerOf(req);
      if (lookedUp && address) await this.credentials.recordRejection(address);
      throw new UnauthorizedException('Not authenticated');
    }

    req.user = user;
    req.credential = session ? 'session' : 'token';
    req.tokenScope = token?.scope;
    this.workspace.bind(user.workspaceId);
    return true;
  }
}
