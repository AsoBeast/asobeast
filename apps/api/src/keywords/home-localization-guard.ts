import type { FieldWriteGuard } from './keyword-field-writer';
import { homeLocalizationOf } from './localization-markets';

export const unlessHomeLocalization =
  (appId: string, localization: string): FieldWriteGuard =>
  async (tx) => {
    const app = await tx.app.findFirst({
      where: { id: appId },
      select: { country: true, defaultLocalization: true },
    });
    return app !== null && localization !== homeLocalizationOf(app);
  };
