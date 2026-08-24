import { Injectable } from '@nestjs/common';
import { ProxyTier } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { spendMonth } from './residential-spend';

const LEDGER_JUSTIFICATION =
  'egress volume is one operator ledger, not a workspace cost';

@Injectable()
export class ProxyLedger {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  record(tier: ProxyTier, requests = 1, month = spendMonth()): Promise<void> {
    if (requests <= 0) return Promise.resolve();
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      LEDGER_JUSTIFICATION,
      async () => {
        await this.prisma.proxySpend.upsert({
          where: { month_tier: { month, tier } },
          create: { month, tier, requests },
          update: { requests: { increment: requests } },
        });
      },
    );
  }

  claim(
    tier: ProxyTier,
    requests: number,
    ceiling: number,
    month = spendMonth(),
  ): Promise<boolean> {
    if (requests <= 0) return Promise.resolve(true);
    if (requests > ceiling) return Promise.resolve(false);
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      LEDGER_JUSTIFICATION,
      async () => {
        const claimed = await this.prisma.$queryRaw<{ requests: number }[]>`
          INSERT INTO "ProxySpend" ("month", "tier", "requests", "updatedAt")
          VALUES (${month}, ${tier}::"ProxyTier", ${requests}, now())
          ON CONFLICT ("month", "tier") DO UPDATE
            SET "requests" = "ProxySpend"."requests" + ${requests},
                "updatedAt" = now()
            WHERE "ProxySpend"."requests" + ${requests} <= ${ceiling}
          RETURNING "requests"
        `;
        return claimed.length > 0;
      },
    );
  }

  count(tier: ProxyTier, month = spendMonth()): Promise<number> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      LEDGER_JUSTIFICATION,
      async () => {
        const row = await this.prisma.proxySpend.findUnique({
          where: { month_tier: { month, tier } },
          select: { requests: true },
        });
        return row?.requests ?? 0;
      },
    );
  }
}
