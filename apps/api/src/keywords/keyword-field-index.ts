import { KeywordSource } from '@prisma/client';
import { readLocalizations } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface StoredKeywordField {
  localization: string;
  phrases: readonly string[];
}

export type KeywordFieldIndex = (country: string, text: string) => boolean;

export const NO_KEYWORD_FIELD: KeywordFieldIndex = () => false;

export const defaultLocalizationOf = (country: string): string | undefined =>
  readLocalizations(country)[0];

export function indexKeywordFields(
  home: string,
  fields: readonly StoredKeywordField[],
): KeywordFieldIndex {
  const localization = defaultLocalizationOf(home);
  const phrases = new Set(
    fields.find((field) => field.localization === localization)?.phrases,
  );
  return (country, text) => country === home && phrases.has(text);
}

export async function loadKeywordFieldIndex(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordFieldIndex> {
  const app = await prisma.app.findFirst({
    where: { id: appId },
    select: {
      country: true,
      keywordFields: { select: { localization: true, phrases: true } },
    },
  });
  return app
    ? indexKeywordFields(app.country, app.keywordFields)
    : NO_KEYWORD_FIELD;
}

export const reportedSource = (
  source: KeywordSource,
  inKeywordField: boolean,
): KeywordSource => (inKeywordField ? KeywordSource.KEYWORD_FIELD : source);
