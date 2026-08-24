import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

const SIZE_JUSTIFICATION =
  'the size of the database on disk belongs to the host, not to any workspace';

export interface ResourceUsage {
  databaseBytes: number | null;
  diskBudgetBytes: number;
  redisUsedBytes: number | null;
  redisMaxBytes: number | null;
}

interface RedisInfo {
  info(section: string): Promise<string>;
}

@Injectable()
export class ResourceMetricsCollector {
  private readonly logger = new Logger(ResourceMetricsCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
  ) {}

  async collect(): Promise<ResourceUsage> {
    const [databaseBytes, memory] = await Promise.all([
      this.databaseBytes(),
      this.redisMemory(),
    ]);

    return {
      databaseBytes,
      diskBudgetBytes: this.config.get('DISK_BUDGET_BYTES', { infer: true }),
      redisUsedBytes: memory.used,
      redisMaxBytes: memory.max,
    };
  }

  private async databaseBytes(): Promise<number | null> {
    try {
      const rows =
        await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
          SIZE_JUSTIFICATION,
          () =>
            this.prisma.$queryRaw<
              { size: bigint }[]
            >`SELECT pg_database_size(current_database()) AS size`,
        );
      return rows[0] === undefined ? null : Number(rows[0].size);
    } catch (error) {
      this.degraded('the database size', error);
      return null;
    }
  }

  private async redisMemory(): Promise<{
    used: number | null;
    max: number | null;
  }> {
    try {
      const client = (await this.queue.getBackend()
        .client) as unknown as RedisInfo;
      const info = await client.info('memory');
      return {
        used: field(info, 'used_memory'),
        max: field(info, 'maxmemory'),
      };
    } catch (error) {
      this.degraded('redis memory', error);
      return { used: null, max: null };
    }
  }

  private degraded(measure: string, error: unknown): void {
    this.logger.warn(
      `${measure} could not be measured, so its metric is missing from this scrape: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function field(info: string, name: string): number | null {
  const match = new RegExp(`^${name}:(\\d+)`, 'm').exec(info);
  return match === null ? null : Number(match[1]);
}
