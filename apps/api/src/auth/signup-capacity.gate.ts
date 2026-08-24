import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store, STORES } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { DailyCapacity } from '../jobs/daily-capacity.service';
import { requestsPerJob } from '../jobs/request-weights';

const GATE_JUSTIFICATION =
  'a signup is refused on total collection capacity, which no workspace owns';

@Injectable()
export class SignupCapacityGate {
  private readonly logger = new Logger(SignupCapacityGate.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
    private readonly capacity: DailyCapacity,
  ) {}

  async assertRoomForOneMore(): Promise<void> {
    const ceiling = this.config.get('SIGNUP_CAPACITY_MAX_UTILIZATION', {
      infer: true,
    });
    if (ceiling <= 0 || !this.config.get('BILLING_ENABLED', { infer: true })) {
      return;
    }

    const utilization = await this.utilization();
    if (utilization < ceiling) return;

    this.logger.error(
      `signup refused: collection is at ${utilization} of capacity, above the ${ceiling} ceiling`,
    );
    throw new ServiceUnavailableException(
      'Registration is paused while collection capacity is restored. Please try again later.',
    );
  }

  async utilization(): Promise<number> {
    const capacityPerDay = await this.totalCapacity();
    if (capacityPerDay <= 0) return 0;
    const demand =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        GATE_JUSTIFICATION,
        () => this.trackedKeywordMarkets(),
      );
    return Math.round((demand / capacityPerDay) * 1000) / 1000;
  }

  private async trackedKeywordMarkets(): Promise<number> {
    const rows = await this.prisma.$queryRaw<
      { store: Store; markets: bigint }[]
    >`
      SELECT k."store" AS store, COUNT(DISTINCT t."keywordId") AS markets
      FROM "TrackedKeyword" t
      JOIN "Keyword" k ON k."id" = t."keywordId"
      WHERE t."active" = true
      GROUP BY k."store"
    `;
    return rows.reduce(
      (total, row) =>
        total + Number(row.markets) * requestsPerJob(row.store, 'keywords'),
      0,
    );
  }

  private async totalCapacity(): Promise<number> {
    const perStore = await Promise.all(
      STORES.map((store) => this.capacity.perDay(store)),
    );
    return perStore.reduce((total, capacity) => total + capacity, 0);
  }
}
