import {
  COVERAGE_PREVIEW_CHANGES,
  countChars,
  KEYWORD_BUCKETS,
  lintDescription,
  lintKeywordField,
  lintShortDescription,
  lintSubtitle,
  lintTitle,
  STORE_FIELD_LIMITS,
  targetSlotRole,
  tokenize,
  type CoveragePreviewChange,
  type CoveragePreviewKeyword,
  type CoveragePreviewRequest,
  type CoveragePreviewResult,
  type CoveragePreviewTarget,
  type CoverageVerdict,
  type DraftWastedWord,
  type MetadataAuditResult,
  type MetadataField,
  type MetadataFieldAudit,
  type Store,
} from "@asobeast/shared";

export const COVERAGE_PREVIEW_FAIL_COOKIE = "e2e_coverage_preview_fail";

export const COVERAGE_PREVIEW_MARKETS_COOKIE = "e2e_coverage_preview_markets";

export type PreviewMarkets = "waiting" | "none" | null;

export const previewMarketsOf = (
  value: string | null | undefined,
): PreviewMarkets => (value === "waiting" || value === "none" ? value : null);

type DraftField = Exclude<
  keyof CoveragePreviewRequest,
  "localization" | "country"
>;

type Texts = Record<DraftField, string>;

const JUDGED: Record<Store, DraftField[]> = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription", "description"],
};

const LINTED: Record<Store, DraftField[]> = {
  APP_STORE: ["title", "subtitle", "keywordField", "description"],
  GOOGLE_PLAY: ["title", "shortDescription", "description"],
};

const phrasesOf = (field: DraftField, value: string): string[][] =>
  field === "keywordField" ? value.split(",").map(tokenize) : [tokenize(value)];

const holdsRun = (words: string[], run: string[]): boolean =>
  run.length > 0 &&
  words.some((_, start) => run.every((word, at) => words[start + at] === word));

const splitAcross = (texts: Texts, run: string[]): boolean =>
  run.length > 0 &&
  run.every((word) =>
    JUDGED.APP_STORE.some((field) => tokenize(texts[field]).includes(word)),
  );

function liveTexts(audit: MetadataAuditResult): Texts {
  const valueOf = (field: MetadataField) =>
    audit.fields.find((entry) => entry.field === field)?.value ?? "";
  return {
    title: valueOf("title"),
    subtitle: valueOf("subtitle"),
    shortDescription: valueOf("shortDescription"),
    keywordField: valueOf("keywordField"),
    description: valueOf("description"),
  };
}

function verdict(store: Store, texts: Texts, keyword: string): CoverageVerdict {
  const run = tokenize(keyword);
  const fields = JUDGED[store].map((field) => ({
    field,
    covered: phrasesOf(field, texts[field]).some((words) =>
      holdsRun(words, run),
    ),
  }));
  const held = fields.some((field) => field.covered);
  const wordsSplit = store === "APP_STORE" && !held && splitAcross(texts, run);
  return { fields, covered: held || wordsSplit, wordsSplit };
}

function changeOf(
  live: CoverageVerdict,
  draft: CoverageVerdict,
): CoveragePreviewChange {
  if (live.covered) return draft.covered ? "kept" : "lost";
  return draft.covered ? "gained" : "missing";
}

const bucketRank = (bucket: CoveragePreviewKeyword["bucket"]): number =>
  bucket === null ? KEYWORD_BUCKETS.length : KEYWORD_BUCKETS.indexOf(bucket);

function lintOf(store: Store, field: DraftField, texts: Texts) {
  const context = {
    titleWords: tokenize(texts.title),
    subtitleWords: tokenize(texts.subtitle),
  };
  const limit = STORE_FIELD_LIMITS[store][field]?.limit ?? 0;
  if (field === "title") return lintTitle(texts.title, limit, store);
  if (field === "subtitle") return lintSubtitle(texts.subtitle, context, limit);
  if (field === "keywordField") {
    return lintKeywordField(texts.keywordField, context, limit);
  }
  if (field === "shortDescription") {
    return lintShortDescription(texts.shortDescription, context, limit);
  }
  return lintDescription(texts.description, limit);
}

function fieldAudits(store: Store, texts: Texts): MetadataFieldAudit[] {
  return LINTED[store].map((field) => ({
    field,
    value: texts[field],
    chars: countChars(texts[field]),
    limit: STORE_FIELD_LIMITS[store][field]?.limit ?? 0,
    indexed: STORE_FIELD_LIMITS[store][field]?.indexed ?? false,
    issues: lintOf(store, field, texts),
  }));
}

function repeatedWords(store: Store, texts: Texts): DraftWastedWord[] {
  if (store !== "APP_STORE") return [];
  const holders = new Map<string, MetadataField[]>();
  for (const field of JUDGED.APP_STORE) {
    for (const word of tokenize(texts[field])) {
      const held = holders.get(word) ?? [];
      if (!held.includes(field)) holders.set(word, [...held, field]);
    }
  }
  return [...holders]
    .filter(([, fields]) => fields.length > 1)
    .map(([word, fields]) => ({ word, reason: "repeated", fields }));
}

function judgedMarkets(
  audit: MetadataAuditResult,
  home: string,
  markets: PreviewMarkets,
): string[] {
  if (markets !== null) return [];
  return [
    ...new Set([home, ...audit.coverage.map((row) => row.country ?? home)]),
  ];
}

export function mockCoveragePreview(
  audit: MetadataAuditResult,
  home: string,
  request: CoveragePreviewRequest,
  {
    previewMarkets = null,
    targetSlots = [],
  }: { previewMarkets?: PreviewMarkets; targetSlots?: readonly string[] } = {},
): CoveragePreviewResult {
  const store = audit.store;
  const live = liveTexts(audit);
  const draft: Texts = { ...live };
  for (const field of LINTED[store]) {
    draft[field] = request[field] ?? live[field];
  }
  const markets = judgedMarkets(audit, home, previewMarkets);
  const keywords = audit.coverage
    .filter((row) => markets.includes(row.country ?? home))
    .map((row) => {
      const before = verdict(store, live, row.text);
      const after = verdict(store, draft, row.text);
      return {
        keywordId: row.keywordId,
        text: row.text,
        country: row.country ?? home,
        bucket: row.bucket,
        live: before,
        draft: after,
        change: changeOf(before, after),
      };
    })
    .sort(
      (a, b) =>
        COVERAGE_PREVIEW_CHANGES.indexOf(a.change) -
          COVERAGE_PREVIEW_CHANGES.indexOf(b.change) ||
        bucketRank(a.bucket) - bucketRank(b.bucket) ||
        a.text.localeCompare(b.text),
    );
  const counts: Record<CoveragePreviewChange, number> = {
    lost: 0,
    gained: 0,
    missing: 0,
    kept: 0,
  };
  for (const { change } of keywords) counts[change] += 1;
  return {
    appId: audit.appId,
    store,
    ...(store === "APP_STORE"
      ? { localization: request.localization ?? "en-US" }
      : { country: request.country ?? home }),
    markets,
    waitingMarkets: previewMarkets === "waiting" ? ["gb"] : [],
    fields: fieldAudits(store, draft),
    keywords,
    wastedWords: repeatedWords(store, draft),
    counts,
    ...(targetSlots.length > 0 && markets.length > 0
      ? { targets: previewTargets(store, live, draft, targetSlots) }
      : {}),
  };
}

function previewTargets(
  store: Store,
  live: Texts,
  draft: Texts,
  slots: readonly string[],
): CoveragePreviewTarget[] {
  return slots.flatMap((text, index) =>
    text === ""
      ? []
      : [
          {
            position: index + 1,
            role: targetSlotRole(index),
            text,
            live: verdict(store, live, text),
            draft: verdict(store, draft, text),
          },
        ],
  );
}
