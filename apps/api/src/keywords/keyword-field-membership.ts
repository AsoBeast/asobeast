import { KeywordSource, Prisma } from '@prisma/client';

export const inKeywordField = {
  fieldOrder: { not: null },
} satisfies Prisma.TrackedKeywordWhereInput;

export function reportedSource(row: {
  source: KeywordSource;
  fieldOrder: number | null;
}): KeywordSource {
  return row.fieldOrder === null ? row.source : KeywordSource.KEYWORD_FIELD;
}
