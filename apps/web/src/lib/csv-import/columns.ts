export const IMPORT_FIELDS = ["keyword", "country", "tags", "note"] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type ColumnMapping = Record<ImportField, number | null>;

export const NO_COLUMNS: ColumnMapping = {
  keyword: null,
  country: null,
  tags: null,
  note: null,
};

const ALIASES: Record<ImportField, ReadonlySet<string>> = {
  keyword: new Set([
    "keyword",
    "keywords",
    "keyphrase",
    "keywordphrase",
    "phrase",
    "term",
    "searchterm",
    "searchquery",
    "query",
    "text",
  ]),
  country: new Set([
    "country",
    "countrycode",
    "storefront",
    "market",
    "region",
    "location",
    "cc",
  ]),
  tags: new Set([
    "tags",
    "tag",
    "labels",
    "label",
    "groups",
    "group",
    "keywordgroup",
    "list",
  ]),
  note: new Set(["note", "notes", "comment", "comments", "remark", "remarks"]),
};

export function headerKey(cell: string): string {
  return cell
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export const namesKeyword = (cell: string): boolean =>
  ALIASES.keyword.has(headerKey(cell));

export function detectColumns(header: readonly string[]): ColumnMapping | null {
  const keys = header.map(headerKey);
  const taken = new Set<number>();
  const mapping: ColumnMapping = { ...NO_COLUMNS };
  for (const field of IMPORT_FIELDS) {
    const index = keys.findIndex(
      (key, position) => !taken.has(position) && ALIASES[field].has(key),
    );
    if (index >= 0) {
      mapping[field] = index;
      taken.add(index);
    }
  }
  return mapping.keyword === null ? null : mapping;
}
