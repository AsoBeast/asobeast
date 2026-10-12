import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { WorkspaceContext } from '../../common/tenancy/workspace-context';
import type { AuthenticatedRequest } from '../auth.types';
import { CredentialResolver } from '../credential-resolver';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: CredentialResolver,
    private readonly workspace: WorkspaceContext,
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
    const resolved = await this.resolver.resolve(req);
    if (!resolved) throw new UnauthorizedException('Not authenticated');

    req.user = resolved.user;
    req.credential = resolved.credential;
    req.tokenScope = resolved.tokenScope;
    this.workspace.bind(resolved.user.workspaceId);
    return true;
  }
}
