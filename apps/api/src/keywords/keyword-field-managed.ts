import { ConflictException } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { StoreImportState } from '@asobeast/shared';
import type { SecretBox } from '../common/crypto/secret-box';
import { PrismaService } from '../prisma/prisma.service';

export const STORE_FIELD_MANAGED =
  'The keyword field of this app is imported from App Store Connect. Edit it in App Store Connect, and AsoBeast imports it again with every release.';

export const STORE_IMPORT_NEEDED =
  'Importing the keyword fields needs an active App Store Connect connection. Connect or verify the key in Integrations first.';

export const STORE_IMPORT_FOLLOWING =
  'App Store Connect already imports the keyword fields of this app. Stop importing to edit them here again.';

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

const activeAppStoreConnection = (prisma: PrismaService) =>
  prisma.storeConnection.findFirst({
    where: { store: Store.APP_STORE, status: 'active' },
    select: { id: true },
  });

export const importStateOf = async (
  prisma: PrismaService,
  box: SecretBox | null,
  appId: string,
): Promise<StoreImportState> => {
  const sync = await fieldSyncOf(prisma, appId);
  const connected =
    box !== null && (await activeAppStoreConnection(prisma)) !== null;
  if (!connected) return sync ? 'paused' : 'unavailable';
  return sync ? 'following' : 'available';
};

export const refuseManagedField = async (
  prisma: PrismaService,
  box: SecretBox | null,
  appId: string,
): Promise<void> => {
  if ((await importStateOf(prisma, box, appId)) === 'following') {
    throw new ConflictException(STORE_FIELD_MANAGED);
  }
};
