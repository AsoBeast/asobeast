import { Inject, Injectable } from '@nestjs/common';
import type { SecretBox } from '../common/crypto/secret-box';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PrismaService } from '../prisma/prisma.service';
import { SECRET_BOX } from '../store-connect/secret-box.provider';
import { StoreReportQueue } from '../store-connect/store-report-queue';
import { ActiveWorkspaces } from './active-workspaces';

@Injectable()
export class StoreReportFanOut {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly active: ActiveWorkspaces,
    private readonly queue: StoreReportQueue,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
  ) {}

  get enabled(): boolean {
    return this.box !== null;
  }

  async run(now = new Date()): Promise<number> {
    if (!this.enabled) return 0;
    const connections =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        'the store report sync spans every connected workspace before scoping to each',
        () =>
          this.prisma.storeConnection.findMany({
            where: { status: 'active' },
            select: { workspaceId: true, store: true },
          }),
      );
    const active = new Set(await this.active.forDailyRun(now));
    const due = connections.filter(({ workspaceId }) =>
      active.has(workspaceId),
    );
    for (const { workspaceId, store } of due) {
      await this.queue.enqueue(workspaceId, store);
    }
    return due.length;
  }
}
