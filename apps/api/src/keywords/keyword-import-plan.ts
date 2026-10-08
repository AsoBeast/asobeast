import {
  KeywordImportCost,
  KeywordImportRowResult,
  KeywordImportSummary,
  Store,
} from '@asobeast/shared';
import { requestsPerJob } from '../jobs/request-weights';
import { ClassifiedRow, ImportCandidate, pairKey } from './keyword-import';

export interface TrackingState {
  own: 'active' | 'paused' | null;
  elsewhere: boolean;
}

export type TrackingLookup = ReadonlyMap<string, TrackingState>;

export interface Addition {
  candidate: ImportCandidate;
  status: 'new' | 'resume';
  opensMarket: boolean;
}

export interface ImportPlan {
  results: KeywordImportRowResult[];
  additions: Addition[];
}

const NOT_TRACKED: TrackingState = { own: null, elsewhere: false };

function settled(
  row: Exclude<ClassifiedRow, { kind: 'candidate' }>,
): KeywordImportRowResult {
  const { index, keyword, country } = row;
  return row.kind === 'invalid'
    ? {
        index,
        keyword,
        country,
        status: 'invalid',
        reason: row.reason,
        message: row.message,
      }
    : {
        index,
        keyword,
        country,
        status: 'duplicate',
        duplicateOf: row.duplicateOf,
      };
}

export function planImport(
  classified: readonly ClassifiedRow[],
  tracking: TrackingLookup,
  room: number | null,
): ImportPlan {
  let remaining = room;
  const results: KeywordImportRowResult[] = [];
  const additions: Addition[] = [];

  for (const row of classified) {
    if (row.kind !== 'candidate') {
      results.push(settled(row));
      continue;
    }
    const { candidate } = row;
    const identity = {
      index: candidate.index,
      keyword: candidate.text,
      country: candidate.country,
    };
    const state =
      tracking.get(pairKey(candidate.country, candidate.text)) ?? NOT_TRACKED;
    if (state.own === 'active') {
      results.push({ ...identity, status: 'tracked' });
      continue;
    }
    const opensMarket = !state.elsewhere;
    if (opensMarket && remaining !== null) {
      if (remaining <= 0) {
        results.push({ ...identity, status: 'overQuota' });
        continue;
      }
      remaining -= 1;
    }
    const status = state.own === 'paused' ? 'resume' : 'new';
    results.push({ ...identity, status });
    additions.push({ candidate, status, opensMarket });
  }
  return { results, additions };
}

export function summarize(
  results: readonly KeywordImportRowResult[],
): KeywordImportSummary {
  const summary: KeywordImportSummary = {
    rows: results.length,
    new: 0,
    resume: 0,
    tracked: 0,
    duplicate: 0,
    invalid: 0,
    overQuota: 0,
  };
  for (const { status } of results) {
    summary[status] += 1;
  }
  return summary;
}

export function costOf(
  additions: readonly Addition[],
  store: Store,
  marketListings = 0,
): KeywordImportCost {
  const keywordMarkets = additions.filter(
    (addition) => addition.opensMarket,
  ).length;
  return {
    store,
    keywordMarkets,
    dailyRequests:
      keywordMarkets * requestsPerJob(store, 'keywords') +
      marketListings * requestsPerJob(store, 'apps'),
  };
}
