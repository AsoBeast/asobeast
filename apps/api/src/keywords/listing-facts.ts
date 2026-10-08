import { latestListingTexts, relevanceText } from '../apps/listing-texts';
import { PrismaService } from '../prisma/prisma.service';
import { AppFacts } from './keywords.mapper';
import { KeywordApp } from './keywords.support';

export async function listingFacts(
  prisma: PrismaService,
  app: Pick<KeywordApp, 'id' | 'country'>,
  markets: readonly string[] = [],
): Promise<AppFacts> {
  const listings = await latestListingTexts(prisma, app.id, app.country, [
    app.country,
    ...markets,
  ]);
  const home = listings.get(app.country);
  const marketTexts = new Map(
    [...listings]
      .filter(([market]) => market !== app.country)
      .map(([market, listing]) => [market, relevanceText(listing)]),
  );
  return {
    snapshotText: home ? relevanceText(home) : '',
    marketTexts,
  };
}
