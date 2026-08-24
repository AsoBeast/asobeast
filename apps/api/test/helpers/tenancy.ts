import type { INestApplication } from '@nestjs/common';
import { WorkspaceContext } from '../../src/common/tenancy/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';

export function asWorkspace<T>(
  app: INestApplication,
  work: () => Promise<T>,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
): Promise<T> {
  return app
    .get(WorkspaceContext, { strict: false })
    .run(workspaceId, async () => {
      const result = await work();
      return result;
    });
}
