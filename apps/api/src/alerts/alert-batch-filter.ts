import {
  AlertBatchAppSection,
  AlertBatchPayload,
  GranularAlertPayload,
  WebhookEvent,
} from '@asobeast/shared';
import { reachesChannel } from './confirm-drops';
import { reviewGate } from './review-routing';

function sectionHasContent(section: AlertBatchAppSection): boolean {
  return (
    section.rankDrops.length > 0 ||
    section.rankImprovements.length > 0 ||
    section.rankMilestones.length > 0 ||
    section.firstRankings.length > 0 ||
    section.overtakes.length > 0 ||
    (section.chartMoves ?? []).length > 0 ||
    section.serpEntrants.length > 0 ||
    section.changes.length > 0 ||
    section.negativeReviews.length > 0 ||
    (section.newReviews ?? []).length > 0 ||
    section.actions.length > 0 ||
    section.competitors.length > 0
  );
}

export function filterBatch(
  batch: AlertBatchPayload,
  allowed: Set<string>,
  reviewScores: readonly number[] = [],
  confirmDrops = false,
): AlertBatchPayload | null {
  const keeps = reviewGate(batch.events, allowed, reviewScores);
  const events = batch.events.filter(
    (event) => keeps(event) && reachesChannel(event, confirmDrops),
  );
  const ownedOnly = <T extends GranularAlertPayload>(
    event: WebhookEvent,
    list: T[],
  ): T[] =>
    batch.scope === 'owned_apps' && allowed.has(event)
      ? list.filter((payload) => reachesChannel(payload, confirmDrops))
      : [];
  const apps = batch.apps
    .map((section): AlertBatchAppSection => ({
      app: section.app,
      rankDrops: ownedOnly('rank.dropped', section.rankDrops),
      rankImprovements: ownedOnly('rank.improved', section.rankImprovements),
      rankMilestones: ownedOnly('rank.milestone', section.rankMilestones),
      firstRankings: ownedOnly('rank.first', section.firstRankings),
      overtakes: ownedOnly('rank.overtaken', section.overtakes),
      chartMoves:
        batch.scope === 'owned_apps'
          ? (section.chartMoves ?? []).filter((move) => allowed.has(move.event))
          : [],
      serpEntrants:
        batch.scope === 'owned_apps' && allowed.has('serp.entrant')
          ? section.serpEntrants
          : [],
      changes:
        batch.scope === 'owned_apps' && allowed.has('metadata.changed')
          ? section.changes
          : [],
      negativeReviews: ownedOnly(
        'review.negative',
        section.negativeReviews,
      ).filter(keeps),
      newReviews: ownedOnly('review.new', section.newReviews ?? []).filter(
        keeps,
      ),
      actions:
        batch.scope === 'owned_apps' && allowed.has('action.opened')
          ? section.actions
          : [],
      competitors:
        batch.scope === 'competitors' && allowed.has('metadata.changed')
          ? section.competitors
          : [],
    }))
    .filter(sectionHasContent);

  if (events.length === 0 || apps.length === 0) return null;
  const appCount =
    batch.scope === 'owned_apps'
      ? apps.length
      : new Set(
          apps.flatMap((section) =>
            section.competitors.map((competitor) => competitor.app.id),
          ),
        ).size;
  return {
    ...batch,
    apps,
    events,
    totals: { events: events.length, apps: appCount },
  };
}
