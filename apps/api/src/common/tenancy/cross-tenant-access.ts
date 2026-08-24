import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceContext } from './workspace-context';

@Injectable()
export class CrossTenantAccess {
  private readonly logger = new Logger(CrossTenantAccess.name);

  constructor(private readonly workspace: WorkspaceContext) {}

  becauseThisWorkIsNotOwnedByOneWorkspace<T>(
    justification: string,
    work: () => Promise<T>,
  ): Promise<T> {
    this.logger.debug(`cross-tenant access: ${justification}`);
    return this.workspace.runCrossTenant(work);
  }
}
