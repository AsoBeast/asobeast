import {
  KeywordCoverageRow,
  MetadataAuditResult,
  MetadataFieldAudit,
  TrackedKeywordItem,
  UnknownStorefrontError,
} from '@asobeast/shared';
import { MissingListingError } from '../apps/missing-listing';
import { PrismaService } from '../prisma/prisma.service';

export interface ActionMarketMetadata {
  country: string;
  coverage: KeywordCoverageRow[];
  fields: MetadataFieldAudit[];
}

export interface ActionListings {
  country: string;
  coverage: KeywordCoverageRow[];
  metadataFields: MetadataFieldAudit[];
  marketMetadata: ActionMarketMetadata[];
}

export function metadataMarkets(
  home: string,
  tracked: readonly TrackedKeywordItem[],
): string[] {
  return [
    ...new Set(
      tracked
        .filter((item) => item.active && item.country !== home)
        .map((item) => item.country),
    ),
  ].sort();
}

export function appListings(app: ActionListings): ActionMarketMetadata[] {
  return [
    {
      country: app.country,
      coverage: app.coverage,
      fields: app.metadataFields,
    },
    ...app.marketMetadata,
  ];
}

function isUnreadableMarket(error: unknown): boolean {
  return (
    error instanceof MissingListingError ||
    error instanceof UnknownStorefrontError
  );
}

export async function auditMarkets(
  countries: readonly string[],
  audit: (country: string) => Promise<MetadataAuditResult>,
  onSkip: (country: string, error: unknown) => void,
): Promise<ActionMarketMetadata[]> {
  const markets: ActionMarketMetadata[] = [];
  for (const country of countries) {
    try {
      const { coverage, fields } = await audit(country);
      markets.push({ country, coverage, fields });
    } catch (error) {
      if (!isUnreadableMarket(error)) throw error;
      onSkip(country, error);
    }
  }
  return markets;
}

export async function loadHeldLintFingerprints(
  prisma: PrismaService,
  appIds: readonly string[],
): Promise<Map<string, Set<string>>> {
  const rows = await prisma.actionItem.findMany({
    where: {
      appId: { in: [...appIds] },
      rule: 'metadata.fix_lint',
      status: { not: 'RESOLVED' },
    },
    select: { appId: true, fingerprint: true },
  });
  const held = new Map<string, Set<string>>();
  for (const row of rows) {
    const fingerprints = held.get(row.appId) ?? new Set<string>();
    fingerprints.add(row.fingerprint);
    held.set(row.appId, fingerprints);
  }
  return held;
}
