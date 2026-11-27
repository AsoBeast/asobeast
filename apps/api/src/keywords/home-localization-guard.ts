import type { Prisma } from '@prisma/client';
import type { AppStoreLocalization } from '@asobeast/shared';
import type { FieldWriteGuard } from './keyword-field-writer';
import { homeLocalizationOf } from './localization-markets';

export async function currentHomeLocalization(
  tx: Prisma.TransactionClient,
  appId: string,
): Promise<AppStoreLocalization | null> {
  const app = await tx.app.findFirst({
    where: { id: appId },
    select: { country: true, defaultLocalization: true },
  });
  return app === null ? null : homeLocalizationOf(app);
}

export const unlessHomeLocalization =
  (appId: string, localization: string): FieldWriteGuard =>
  async (tx) => {
    const home = await currentHomeLocalization(tx, appId);
    return home !== null && localization !== home;
  };
