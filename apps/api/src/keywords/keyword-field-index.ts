import { KeywordSource } from '@prisma/client';
import { keywordFieldLocalizations } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface StoredKeywordField {
  localization: string;
  phrases: readonly string[];
}

export type KeywordFieldIndex = (country: string, text: string) => boolean;

export function indexKeywordFields(
  fields: readonly StoredKeywordField[],
): KeywordFieldIndex {
  const phrases = new Map(
    fields.map((field) => [field.localization, new Set(field.phrases)]),
  );
  return (country, text) =>
    keywordFieldLocalizations(country).some(
      (localization) => phrases.get(localization)?.has(text) ?? false,
    );
}

export const storedKeywordFields = (
  prisma: PrismaService,
  appId: string,
): Promise<StoredKeywordField[]> =>
  prisma.keywordField.findMany({
    where: { appId },
    select: { localization: true, phrases: true },
  });

export async function loadKeywordFieldIndex(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordFieldIndex> {
  return indexKeywordFields(await storedKeywordFields(prisma, appId));
}

export const reportedSource = (
  source: KeywordSource,
  inKeywordField: boolean,
): KeywordSource => (inKeywordField ? KeywordSource.KEYWORD_FIELD : source);
