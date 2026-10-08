import { Store } from '@prisma/client';
import { nativeLocalizations } from '@asobeast/shared';
import { listingIn, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';

export interface HomeListingText {
  title: string;
  subtitle: string | null;
  summary: string | null;
}

export async function homeListingTexts(
  prisma: PrismaService,
  app: { id: string; store: Store; country: string },
): Promise<HomeListingText[]> {
  const localizations =
    app.store === Store.APP_STORE ? nativeLocalizations(app.country) : [];
  const rows = await Promise.all(
    [...localizations, null].map((localization) =>
      prisma.appSnapshot.findFirst({
        where: {
          appId: app.id,
          ...listingIn(app.country, app.country, localization),
        },
        orderBy: NEWEST_FIRST,
        select: { title: true, subtitle: true, summary: true },
      }),
    ),
  );
  return rows.filter((row): row is HomeListingText => row !== null);
}
