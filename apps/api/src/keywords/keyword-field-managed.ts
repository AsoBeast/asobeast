import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const STORE_FIELD_MANAGED =
  'The keyword field of this app is imported from App Store Connect. Edit it in App Store Connect, and AsoBeast imports it again with every release.';

export interface StoredFieldSync {
  syncedAt: Date;
  version: string | null;
  lastError: string | null;
}

export const fieldSyncOf = (
  prisma: PrismaService,
  appId: string,
): Promise<StoredFieldSync | null> =>
  prisma.keywordFieldSync.findFirst({
    where: { appId },
    select: { syncedAt: true, version: true, lastError: true },
  });

export const refuseManagedField = async (
  prisma: PrismaService,
  appId: string,
): Promise<void> => {
  if (await fieldSyncOf(prisma, appId)) {
    throw new ConflictException(STORE_FIELD_MANAGED);
  }
};
