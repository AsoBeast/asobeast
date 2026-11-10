import {
  normalizeText,
  type KeywordInspection,
  type KeywordInspectionRequest,
  type KeywordInspectionSummary,
} from "@asobeast/shared";

export const FAILING_KEYWORD = "store timeout";

export const INSPECTION_FAILURE =
  "The App Store did not answer. Try again in a few minutes.";

export const INSPECTED_APPS = [
  "Habit Tracker: Daily Goals",
  "Streaks Planner",
  "Routine Builder",
] as const;

interface StoredInspection {
  pending: KeywordInspection;
  reads: number;
}

const inspections: StoredInspection[] = [];
let inspectionIds = 0;

function completed(pending: KeywordInspection): KeywordInspection {
  return {
    ...pending,
    status: "DONE",
    startedAt: pending.requestedAt,
    completedAt: pending.requestedAt,
    volume: 46.4,
    difficulty100: 38.2,
    opportunity: 61,
    resultCount: INSPECTED_APPS.length,
    provenance: {
      source: "APPLE_SEARCH_SIGNALS",
      formulaVersion: "app-store-v5",
      confidence: "HIGH",
    },
    competition: {
      topCount: INSPECTED_APPS.length,
      medianRatingCount: 12_000,
      strongestRatingCount: 250_000,
      averageRating: 4.6,
      exactTitleMatches: 1,
      titleMatches: 2,
      appsOverHundredThousandRatings: 1,
      medianDaysSinceUpdate: 12,
      freshlyUpdated: 2,
    },
    results: INSPECTED_APPS.map((title, index) => ({
      position: index + 1,
      storeAppId: `inspected-${index + 1}`,
      title,
      developer: `Developer ${index + 1}`,
      iconUrl: null,
      ratingAvg: 4.5,
      ratingCount: Math.round(250_000 / (index + 1)),
      releasedAt: null,
      updatedAt: pending.requestedAt,
      titleMatch: index === 0 ? "phrase" : "none",
      titleSegments:
        index === 0
          ? [
              { text: "Habit Tracker", match: "exact" },
              { text: ": Daily Goals", match: "none" },
            ]
          : [{ text: title, match: "none" }],
    })),
    suggestions: [
      { position: 1, term: pending.keyword },
      { position: 2, term: `${pending.keyword} app` },
    ],
  };
}

function failed(pending: KeywordInspection): KeywordInspection {
  return {
    ...pending,
    status: "FAILED",
    completedAt: pending.requestedAt,
    failure: INSPECTION_FAILURE,
  };
}

function settled(stored: StoredInspection): KeywordInspection {
  if (stored.pending.keyword === FAILING_KEYWORD) return failed(stored.pending);
  const done = completed(stored.pending);
  const earlier = inspections
    .slice(inspections.indexOf(stored) + 1)
    .find(
      (entry) =>
        entry.pending.keywordId === stored.pending.keywordId &&
        current(entry).status === "DONE",
    );
  if (!earlier) return done;
  const before = completed(earlier.pending);
  return {
    ...done,
    previous: {
      inspectionId: before.id,
      completedAt: before.requestedAt,
      volume: (before.volume ?? 0) - 4,
      difficulty100: (before.difficulty100 ?? 0) + 6,
      resultCount: before.resultCount,
      entered: [],
      left: [],
    },
  };
}

function current(stored: StoredInspection): KeywordInspection {
  return stored.reads > 0 ? settled(stored) : stored.pending;
}

function summaryOf(inspection: KeywordInspection): KeywordInspectionSummary {
  return {
    id: inspection.id,
    keywordId: inspection.keywordId,
    keyword: inspection.keyword,
    store: inspection.store,
    country: inspection.country,
    status: inspection.status,
    requestedAt: inspection.requestedAt,
    startedAt: inspection.startedAt,
    completedAt: inspection.completedAt,
    volume: inspection.volume,
    difficulty100: inspection.difficulty100,
    opportunity: inspection.opportunity,
    resultCount: inspection.resultCount,
  };
}

export function requestInspection(
  request: KeywordInspectionRequest,
): KeywordInspection {
  const keyword = normalizeText(request.keyword);
  const keywordId = `inspected-keyword-${request.store}-${request.country}-${keyword}`;
  const running = inspections.find(
    (entry) =>
      entry.pending.keywordId === keywordId &&
      current(entry).status === "PENDING",
  );
  if (running) return running.pending;
  inspectionIds += 1;
  const pending: KeywordInspection = {
    id: `inspection-${inspectionIds}`,
    keywordId,
    keyword,
    store: request.store,
    country: request.country,
    status: "PENDING",
    requestedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    volume: null,
    difficulty100: null,
    opportunity: null,
    resultCount: null,
    provenance: null,
    suggestReach: null,
    signals: null,
    competition: null,
    results: [],
    suggestions: [],
    previous: null,
    failure: null,
  };
  inspections.unshift({ pending, reads: 0 });
  return pending;
}

export function readInspection(id: string): KeywordInspection | null {
  const stored = inspections.find((entry) => entry.pending.id === id);
  if (!stored) return null;
  stored.reads += 1;
  return current(stored);
}

export function listInspections(): { items: KeywordInspectionSummary[] } {
  return { items: inspections.map((entry) => summaryOf(current(entry))) };
}

export function deleteInspection(id: string): boolean {
  const index = inspections.findIndex((entry) => entry.pending.id === id);
  if (index < 0) return false;
  inspections.splice(index, 1);
  return true;
}

export function resetInspections(): void {
  inspections.splice(0, inspections.length);
  inspectionIds = 0;
}
