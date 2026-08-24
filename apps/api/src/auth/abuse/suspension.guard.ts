import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth.types';
import { ALLOW_UNENTITLED_KEY } from '../decorators/allow-unentitled.decorator';
import { rateClassOf } from '../rate-limit/rate-class';
import { WorkspaceSuspendedError } from './abuse.errors';
import { refusesWhileSuspended } from './suspension';

@Injectable()
export class SuspensionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    if (!req.user) return true;

    const refused = refusesWhileSuspended(req.user.workspace, {
      credential: req.credential,
      rateClass: rateClassOf(this.reflector, context, req.method),
      allowedWhileUnentitled:
        this.reflector.getAllAndOverride<boolean>(ALLOW_UNENTITLED_KEY, [
          context.getHandler(),
          context.getClass(),
        ]) === true,
    });
    if (!refused) return true;

    throw new WorkspaceSuspendedError(req.user.workspace.suspendedReason);
  }
}
