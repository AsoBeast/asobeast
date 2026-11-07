import {
  DISCOVERY_RECOMMENDED,
  DiscoveryRowState,
  KeywordDiscoveryCounts,
  RANK_DEPTH,
  utcDayOf,
} from '@asobeast/shared';
import {
  OPPORTUNITY_HIGH,
  OPPORTUNITY_MIN_RELEVANCE,
} from '../scoring/opportunity';

const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Judged {
  position: number | null;
  relevance: number;
  opportunity: number | null;
}

interface Ranked {
  text: string;
  relevance: number;
  traffic: number | null;
  state: DiscoveryRowState;
}

export function discoveryStateOf({
  position,
  relevance,
  opportunity,
}: Judged): DiscoveryRowState {
  if (position !== null) return 'ranked';
  return relevance >= OPPORTUNITY_MIN_RELEVANCE &&
    opportunity !== null &&
    opportunity >= OPPORTUNITY_HIGH
    ? 'opportunity'
    : 'open';
}

const UNKNOWN_TRAFFIC = -1;

const byListOrder = (left: Ranked, right: Ranked): number =>
  right.relevance - left.relevance ||
  (right.traffic ?? UNKNOWN_TRAFFIC) - (left.traffic ?? UNKNOWN_TRAFFIC) ||
  left.text.localeCompare(right.text);

export function rankDiscoveries<T extends Ranked>(
  items: readonly T[],
): { items: (T & { recommended: boolean })[]; counts: KeywordDiscoveryCounts } {
  const ordered = [...items].sort(byListOrder).map((item, index) => ({
    ...item,
    recommended: index < DISCOVERY_RECOMMENDED,
  }));
  return {
    items: ordered,
    counts: {
      all: ordered.length,
      ranked: ordered.filter(({ state }) => state === 'ranked').length,
      opportunity: ordered.filter(({ state }) => state === 'opportunity')
        .length,
    },
  };
}

export const pendingWindowStart = (now: Date): Date =>
  new Date(now.getTime() - PENDING_WINDOW_MS);

export function isPending(
  row: {
    queuedAt: Date | null;
    checkedOn: string | null;
    depth: number | null;
  },
  now: Date,
): boolean {
  if (row.queuedAt === null) return false;
  if (row.queuedAt < pendingWindowStart(now)) return false;
  return (
    row.checkedOn === null ||
    row.checkedOn < utcDayOf(row.queuedAt) ||
    row.depth === null ||
    row.depth < RANK_DEPTH
  );
}
