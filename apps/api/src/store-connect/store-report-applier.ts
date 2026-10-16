import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AscAnalyticsApi,
  AscInstance,
  DiscoveryVariant,
} from './asc-analytics-api';
import { pivotDetailedReport, pivotDiscoveryReport } from './discovery-report';
import {
  funnelUpserts,
  pageUpserts,
  unresolvedTerritories,
} from './store-funnel-rows';

export interface PendingInstance {
  requestId: string;
  appId: string;
  variant: DiscoveryVariant;
  instance: AscInstance;
}

interface Pivoted {
  statements: (workspaceId: string) => Prisma.Sql[];
  rows: number;
  unresolved: string[];
}

async function pivoted(
  variant: DiscoveryVariant,
  raw: Buffer,
  processingDate: string,
  appId: string,
): Promise<Pivoted> {
  if (variant === 'detailed') {
    const rows = await pivotDetailedReport(raw, processingDate);
    return {
      statements: (workspaceId) => pageUpserts(workspaceId, appId, rows),
      rows: rows.length,
      unresolved: unresolvedTerritories(rows),
    };
  }
  const rows = await pivotDiscoveryReport(raw, processingDate);
  return {
    statements: (workspaceId) => funnelUpserts(workspaceId, appId, rows),
    rows: rows.length,
    unresolved: unresolvedTerritories(rows),
  };
}

const PROCESSED_COLUMN = {
  standard: 'lastProcessingDate',
  detailed: 'detailedLastProcessingDate',
} as const satisfies Record<DiscoveryVariant, string>;

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
    { requestId, appId, variant, instance }: PendingInstance,
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
    const pivot = await pivoted(variant, raw, instance.processingDate, appId);
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
        update: {
          raw,
          sizeInBytes: raw.length,
          segments: segments.length,
          fetchedAt: new Date(),
        },
      });
      for (const statement of pivot.statements(workspaceId)) {
        await tx.$executeRaw(statement);
      }
      const column = PROCESSED_COLUMN[variant];
      await tx.storeReportRequest.updateMany({
        where: {
          id: requestId,
          OR: [{ [column]: null }, { [column]: { lt: processingDate } }],
        },
        data: { [column]: processingDate },
      });
      await tx.storeReportInstance.update({
        where: { id: stored.id },
        data: { appliedAt: new Date() },
      });
    });
    return { rows: pivot.rows, unresolved: pivot.unresolved };
  }
}
