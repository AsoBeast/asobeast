import {
  listsRatingDrop,
  type AlertBatchPayload,
  type GranularAlertPayload,
} from '@asobeast/shared';

export function withRatingDropsAtLeast(
  batch: AlertBatchPayload,
  ratingDropTenths: number | null | undefined,
): AlertBatchPayload {
  const keeps = (payload: GranularAlertPayload): boolean =>
    payload.event !== 'rating.dropped' ||
    listsRatingDrop(ratingDropTenths, payload.dropTenths);
  return {
    ...batch,
    events: batch.events.filter(keeps),
    apps: batch.apps.map((section) =>
      section.ratingDrops
        ? { ...section, ratingDrops: section.ratingDrops.filter(keeps) }
        : section,
    ),
  };
}
