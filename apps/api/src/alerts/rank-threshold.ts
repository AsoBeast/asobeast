import type {
  AlertBatchPayload,
  AlertPayload,
  GranularAlertPayload,
} from '@asobeast/shared';

export interface RankThresholdSubscription {
  rankDropThreshold?: number | null;
}

export function reachesRankThreshold(
  payload: AlertPayload,
  threshold: number,
): boolean {
  if (payload.event === 'rank.dropped') {
    return payload.to === null || payload.to - payload.from >= threshold;
  }
  if (payload.event === 'rank.improved') {
    return payload.from === null || payload.from - payload.to >= threshold;
  }
  return true;
}

export function withThreshold<T extends AlertPayload>(
  payload: T,
  threshold: number,
): T {
  return payload.event === 'rank.dropped' || payload.event === 'rank.improved'
    ? { ...payload, threshold }
    : payload;
}

export function subscriptionThreshold(
  subscription: RankThresholdSubscription,
  instanceThreshold: number,
): number {
  return Math.max(
    subscription.rankDropThreshold ?? instanceThreshold,
    instanceThreshold,
  );
}

export function withRankMovesAtLeast(
  batch: AlertBatchPayload,
  threshold: number | undefined,
): AlertBatchPayload {
  if (threshold === undefined) return batch;
  const kept = <T extends GranularAlertPayload>(list: readonly T[]): T[] =>
    list
      .filter((payload) => reachesRankThreshold(payload, threshold))
      .map((payload) => withThreshold(payload, threshold));
  return {
    ...batch,
    events: kept(batch.events),
    apps: batch.apps.map((section) => ({
      ...section,
      rankDrops: kept(section.rankDrops),
      rankImprovements: kept(section.rankImprovements),
    })),
  };
}
