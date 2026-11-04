import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';

@Injectable()
export class DefaultAlertsMarker {
  constructor(private readonly workspace: WorkspaceContext) {}

  async claim(
    db: Pick<Prisma.TransactionClient, 'workspace'>,
    now = new Date(),
  ): Promise<boolean> {
    const claimed = await db.workspace.updateMany({
      where: {
        id: this.workspace.require('the default alerts marker'),
        defaultAlertsAt: null,
      },
      data: { defaultAlertsAt: now },
    });
    return claimed.count > 0;
  }
}
