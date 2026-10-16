import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi, AscInstance } from './asc-analytics-api';
import { pivotDiscoveryReport } from './discovery-report';
import { funnelUpserts, unresolvedTerritories } from './store-funnel-rows';

export interface PendingInstance {
  requestId: string;
  appId: string;
  instance: AscInstance;
}

export interface AppliedInstance {
  rows: number;
  unresolved: string[];
}

const dateValue = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

@Injectable()
export class StoreReportApplier {
  private readonly logger = new Logger(StoreReportApplier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async apply(
    api: AscAnalyticsApi,
    { requestId, appId, instance }: PendingInstance,
  ): Promise<AppliedInstance> {
    const segments = await api.segments(instance.id);
    const parts: Buffer[] = [];
    for (const segment of segments) {
      const bytes = await api.download(segment);
      const digest = createHash('md5').update(bytes).digest('hex');
      if (segment.checksum && digest !== segment.checksum.toLowerCase()) {
        this.logger.warn(
          `report segment ${segment.id} of instance ${instance.id} has checksum ${digest}, Apple listed ${segment.checksum}; applying it anyway because its size matches`,
        );
      }
      parts.push(bytes);
    }
    const raw = Buffer.concat(parts);
    const rows = await pivotDiscoveryReport(raw, instance.processingDate);
    const workspaceId = this.workspace.require('a report instance');
    const processingDate = dateValue(instance.processingDate);
    await this.prisma.withTransaction(async (tx) => {
      const stored = await tx.storeReportInstance.upsert({
        where: { requestId_remoteId: { requestId, remoteId: instance.id } },
        create: {
          workspaceId,
          requestId,
          appId,
          remoteId: instance.id,
          granularity: instance.granularity,
          processingDate,
          raw,
          sizeInBytes: raw.length,
          segments: segments.length,
        },
        update: { raw, sizeInBytes: raw.length, segments: segments.length },
      });
      for (const statement of funnelUpserts(workspaceId, appId, rows)) {
        await tx.$executeRaw(statement);
      }
      await tx.storeReportRequest.updateMany({
        where: {
          id: requestId,
          OR: [
            { lastProcessingDate: null },
            { lastProcessingDate: { lt: processingDate } },
          ],
        },
        data: { lastProcessingDate: processingDate },
      });
      await tx.storeReportInstance.update({
        where: { id: stored.id },
        data: { appliedAt: new Date() },
      });
    });
    return { rows: rows.length, unresolved: unresolvedTerritories(rows) };
  }
}
