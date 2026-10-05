import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth.types';
import { ALLOW_UNENTITLED_KEY } from '../decorators/allow-unentitled.decorator';
import { EXPORTS_WORKSPACE_DATA_KEY } from '../decorators/exports-workspace-data.decorator';
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
      allowedWhileUnentitled: this.flag(context, ALLOW_UNENTITLED_KEY),
      exportsWorkspaceData: this.flag(context, EXPORTS_WORKSPACE_DATA_KEY),
    });
    if (!refused) return true;

    throw new WorkspaceSuspendedError(req.user.workspace.suspendedReason);
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
