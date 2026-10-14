import { homeLocalization } from '../keywords/localization-markets';
import { PrismaService } from '../prisma/prisma.service';

export interface ShippingApp {
  id: string;
  country: string;
}

export const withHomeLocalization = (
  home: string,
  stored: readonly string[],
): string[] => [...new Set([homeLocalization(home), ...stored])];

export async function shippedLocalizations(
  prisma: PrismaService,
  app: ShippingApp,
): Promise<string[]> {
  const rows = await prisma.appLocalization.findMany({
    where: { appId: app.id },
    select: { localization: true },
  });
  return withHomeLocalization(
    app.country,
    rows.map(({ localization }) => localization),
  );
}
