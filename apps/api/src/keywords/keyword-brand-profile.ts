import { Store } from '@prisma/client';
import { LATEST_HOME_LISTING } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { contentWords } from './brand-words';
import {
  BrandProfile,
  brandProfileOf,
  classifyKeyword,
  profileForListing,
} from './keyword-class';
import type { KeywordClassOf } from './keywords.mapper';

export async function loadBrandProfile(
  prisma: PrismaService,
  app: { id: string; store: Store },
): Promise<BrandProfile> {
  const row = await prisma.app.findFirst({
    where: { id: app.id },
    select: {
      name: true,
      snapshots: { ...LATEST_HOME_LISTING, select: { raw: true } },
      competitors: {
        where: { isCompetitor: true },
        orderBy: { createdAt: 'asc' },
        select: { name: true },
      },
    },
  });
  return brandProfileOf({
    title: row?.name ?? null,
    developer: extractRawFacts(app.store, row?.snapshots[0]?.raw ?? null)
      .developerName,
    competitorTitles: row?.competitors.map((rival) => rival.name) ?? [],
  });
}

export function keywordClassifier(
  profile: BrandProfile,
  texts: {
    snapshotText: string;
    marketTexts?: ReadonlyMap<string, string>;
    marketTitles?: ReadonlyMap<string, readonly string[]>;
  },
): KeywordClassOf {
  const profiles = new Map<string, BrandProfile>();
  const profileOf = (country: string): BrandProfile => {
    const known = profiles.get(country);
    if (known) return known;
    const market = profileForListing(profile, {
      words: contentWords(
        texts.marketTexts?.get(country) ?? texts.snapshotText,
      ),
      titles: texts.marketTitles?.get(country) ?? [],
    });
    profiles.set(country, market);
    return market;
  };
  return ({ text, country, flags, serpRelevance }) =>
    classifyKeyword({ text, flags, serpRelevance }, profileOf(country));
}
