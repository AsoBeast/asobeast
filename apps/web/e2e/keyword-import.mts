import {
  countMaxLengthChars,
  isKeywordTag,
  isStorefront,
  KEYWORD_NOTE_MAX_LENGTH,
  KEYWORD_TAG_RULE,
  KEYWORD_TAGS_MAX,
  normalizeKeywordNote,
  normalizeKeywordTags,
  normalizeText,
  TRACKED_KEYWORD_CHAR_LIMIT,
  UnknownStorefrontError,
  type KeywordImportReason,
  type KeywordImportRequest,
  type KeywordImportResult,
  type KeywordImportRowResult,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";

export interface MockAddition {
  text: string;
  country: string;
  tags: string[];
  note: string | null;
  status: "new" | "resume";
}

interface Planned {
  result: KeywordImportResult;
  additions: MockAddition[];
}

const WORD_LIMIT = 5;

function refusal(
  keyword: string,
  country: string,
  index: number,
  reason: KeywordImportReason,
  message: string,
): KeywordImportRowResult {
  return { index, keyword, country, status: "invalid", reason, message };
}

export function planMockImport(
  existing: readonly TrackedKeywordItem[],
  store: Store,
  homeCountry: string,
  request: KeywordImportRequest,
  limit: number | null,
): Planned {
  const market = request.country ?? homeCountry;
  const claimed = new Map<string, number>();
  const results: KeywordImportRowResult[] = [];
  const additions: MockAddition[] = [];
  const used = existing.filter((row) => row.active).length;
  let room = limit === null ? Infinity : Math.max(0, limit - used);

  request.rows.forEach((row, index) => {
    const country = row.country?.trim().toLowerCase() || market;
    const text = normalizeText(row.keyword);
    const tags = normalizeKeywordTags(row.tags ?? []);
    const note = normalizeKeywordNote(row.note ?? null);
    const bad = (reason: KeywordImportReason, message: string) =>
      results.push(
        refusal(text || row.keyword.trim(), country, index, reason, message),
      );

    if (!text) return bad("empty", "Keyword must not be empty");
    if (text.length > TRACKED_KEYWORD_CHAR_LIMIT) {
      return bad(
        "tooLong",
        `Keyword exceeds ${TRACKED_KEYWORD_CHAR_LIMIT} characters`,
      );
    }
    if (text.split(" ").length > WORD_LIMIT) {
      return bad(
        "tooManyWords",
        `Keyword "${text}" exceeds ${WORD_LIMIT} words`,
      );
    }
    if (!isStorefront(store, country)) {
      return bad(
        "unknownCountry",
        new UnknownStorefrontError(store, country).message,
      );
    }
    if (tags.length > KEYWORD_TAGS_MAX) {
      return bad(
        "tooManyTags",
        `A keyword takes at most ${KEYWORD_TAGS_MAX} tags, this row has ${tags.length}`,
      );
    }
    const invalidTag = tags.find((tag) => !isKeywordTag(tag));
    if (invalidTag !== undefined) {
      return bad(
        "invalidTag",
        `Tag "${invalidTag}" is not valid, a tag is ${KEYWORD_TAG_RULE}`,
      );
    }
    const noteLength = note === null ? 0 : countMaxLengthChars(note);
    if (noteLength > KEYWORD_NOTE_MAX_LENGTH) {
      return bad(
        "noteTooLong",
        `A note is at most ${KEYWORD_NOTE_MAX_LENGTH} characters, this one has ${noteLength}`,
      );
    }

    const key = `${country}~${text}`;
    const first = claimed.get(key);
    if (first !== undefined) {
      results.push({
        index,
        keyword: text,
        country,
        status: "duplicate",
        duplicateOf: first,
      });
      return;
    }
    claimed.set(key, index);

    const identity = { index, keyword: text, country };
    const own = existing.find(
      (entry) => entry.text === text && entry.country === country,
    );
    if (own?.active) {
      results.push({ ...identity, status: "tracked" });
      return;
    }
    if (room <= 0) {
      results.push({ ...identity, status: "overQuota" });
      return;
    }
    room -= 1;
    const status = own ? "resume" : "new";
    results.push({ ...identity, status });
    additions.push({ text, country, tags, note, status });
  });

  const summary = {
    rows: results.length,
    new: 0,
    resume: 0,
    tracked: 0,
    duplicate: 0,
    invalid: 0,
    overQuota: 0,
  };
  for (const { status } of results) summary[status] += 1;

  return {
    additions,
    result: {
      dryRun: true,
      imported: 0,
      summary,
      cost: {
        store,
        keywordMarkets: additions.length,
        dailyRequests: additions.length * (store === "GOOGLE_PLAY" ? 8 : 1),
      },
      quota: limit === null ? null : { used, limit, upgradeTo: "ultimate" },
      results,
    },
  };
}
