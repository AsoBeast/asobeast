import { Injectable } from '@nestjs/common';
import { AppSnapshot, Prisma } from '@prisma/client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { ReadListing, ScreenshotPolicy } from './screenshot-policy';
import { screenshotRows } from './screenshot-rows';

@Injectable()
export class ScreenshotRecorder {
  constructor(
    private readonly policy: ScreenshotPolicy,
    private readonly workspace: WorkspaceContext,
  ) {}

  async record(
    tx: Prisma.TransactionClient,
    storefront: ReadListing,
    snapshot: Pick<AppSnapshot, 'id' | 'raw'>,
  ): Promise<number> {
    const reads = this.policy.languagesFor(storefront).length > 0;
    const rows = screenshotRows(
      storefront.store,
      snapshot.raw,
      reads ? 'pending' : 'skipped',
    );
    if (rows.length === 0) return 0;

    const workspaceId = this.workspace.require('a screenshot record');
    await tx.snapshotScreenshot.createMany({
      data: rows.map((row) => ({
        ...row,
        snapshotId: snapshot.id,
        workspaceId,
      })),
    });
    return reads ? rows.length : 0;
  }
}
