import { KeywordSource, Prisma } from '@prisma/client';
import type { DefaultingListing } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { storefrontReads } from './localization-markets';

export interface StoredKeywordField {
  localization: string;
  phrases: readonly string[];
}

export type KeywordFieldIndex = (country: string, text: string) => boolean;

export function indexKeywordFields(
  app: DefaultingListing,
  fields: readonly StoredKeywordField[],
): KeywordFieldIndex {
  const phrases = new Map(
    fields.map((field) => [field.localization, new Set(field.phrases)]),
  );
  return (country, text) =>
    storefrontReads(app, country).some(
      ({ localization }) => phrases.get(localization)?.has(text) ?? false,
    );
}

export const keywordFieldOwner = (
  client: Prisma.TransactionClient | PrismaService,
  appId: string,
): Promise<DefaultingListing | null> =>
  client.app.findFirst({
    where: { id: appId },
    select: { country: true, defaultLocalization: true },
  });

export const storedKeywordFields = (
  prisma: PrismaService,
  appId: string,
): Promise<StoredKeywordField[]> =>
  prisma.keywordField.findMany({
    where: { appId },
    select: { localization: true, phrases: true },
  });

export async function storedPhrases(
  client: Prisma.TransactionClient | PrismaService,
  appId: string,
  localization: string,
): Promise<string[]> {
  const field = await client.keywordField.findUnique({
    where: { appId_localization: { appId, localization } },
    select: { phrases: true },
  });
  return field?.phrases ?? [];
}

export async function loadKeywordFieldIndex(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordFieldIndex> {
  const [app, fields] = await Promise.all([
    keywordFieldOwner(prisma, appId),
    storedKeywordFields(prisma, appId),
  ]);
  return app === null ? () => false : indexKeywordFields(app, fields);
}

export const reportedSource = (
  source: KeywordSource,
  inKeywordField: boolean,
): KeywordSource => (inKeywordField ? KeywordSource.KEYWORD_FIELD : source);
