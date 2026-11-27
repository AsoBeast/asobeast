import type { DefaultingListing } from '@asobeast/shared';
import { homeLocalizationOf } from '../keywords/localization-markets';
import { PrismaService } from '../prisma/prisma.service';

export interface ShippingApp {
  id: string;
  country: string;
  defaultLocalization: string | null;
}

export const withHomeLocalization = (
  app: DefaultingListing,
  stored: readonly string[],
): string[] => [...new Set([homeLocalizationOf(app), ...stored])];

export async function shippedLocalizations(
  prisma: PrismaService,
  app: ShippingApp,
): Promise<string[]> {
  const rows = await prisma.appLocalization.findMany({
    where: { appId: app.id },
    select: { localization: true },
  });
  return withHomeLocalization(
    app,
    rows.map(({ localization }) => localization),
  );
}
