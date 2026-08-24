import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { correlationIdOf } from '../logging/correlation';
import { WorkspaceContext } from './workspace-context';

@Injectable()
export class WorkspaceContextMiddleware implements NestMiddleware {
  constructor(private readonly workspace: WorkspaceContext) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    this.workspace.openScope(() => {
      this.workspace.correlate(correlationIdOf(request.headers));
      next();
    });
  }
}
