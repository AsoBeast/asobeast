import type {
  KeywordInspection,
  KeywordInspectionRequest,
  KeywordInspectionSummary,
} from "@asobeast/shared";

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
      ratingCount: 250_000 / (index + 1),
      releasedAt: null,
      updatedAt: pending.requestedAt,
      titleMatch: index === 0 ? "exact" : "someWords",
    })),
    suggestions: [
      { position: 1, term: pending.keyword },
      { position: 2, term: `${pending.keyword} app` },
    ],
  };
}

function current(stored: StoredInspection): KeywordInspection {
  return stored.reads > 0 ? completed(stored.pending) : stored.pending;
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
  inspectionIds += 1;
  const pending: KeywordInspection = {
    id: `inspection-${inspectionIds}`,
    keywordId: `inspected-keyword-${request.store}-${request.country}-${request.keyword.trim().toLowerCase()}`,
    keyword: request.keyword.trim().toLowerCase(),
    store: request.store,
    country: request.country,
    status: "PENDING",
    requestedAt: new Date().toISOString(),
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
  const answer = current(stored);
  stored.reads += 1;
  return answer;
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
