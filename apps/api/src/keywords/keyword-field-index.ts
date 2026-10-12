import { KeywordSource } from '@prisma/client';
import { readLocalizations } from '@asobeast/shared';
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
    readLocalizations(country).some(
      (localization) => phrases.get(localization)?.has(text) ?? false,
    );
}

export async function loadKeywordFieldIndex(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordFieldIndex> {
  return indexKeywordFields(
    await prisma.keywordField.findMany({
      where: { appId },
      select: { localization: true, phrases: true },
    }),
  );
}

export const reportedSource = (
  source: KeywordSource,
  inKeywordField: boolean,
): KeywordSource => (inKeywordField ? KeywordSource.KEYWORD_FIELD : source);
