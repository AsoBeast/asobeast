import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AppLocalizationRecord {
  appId: string;
  workspaceId: string;
  localization: string;
  origin: 'manual' | 'detected';
}

export async function recordAppLocalizations(
  client: Prisma.TransactionClient | PrismaService,
  rows: readonly AppLocalizationRecord[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { count } = await client.appLocalization.createMany({
    data: [...rows],
    skipDuplicates: true,
  });
  return count;
}
