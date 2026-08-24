import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { OWNER_ROLE } from '../workspace-roles';
import type { AuthenticatedRequest } from '../auth.types';

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    if (req.user?.role === OWNER_ROLE) return true;

    throw new ForbiddenException('Only the workspace owner can do this');
  }
}
