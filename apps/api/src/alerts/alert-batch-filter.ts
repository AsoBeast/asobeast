import {
  AlertBatchAppSection,
  AlertBatchPayload,
  GranularAlertPayload,
  WebhookEvent,
} from '@asobeast/shared';
import { reachesChannel } from './confirm-drops';

function sectionHasContent(section: AlertBatchAppSection): boolean {
  return (
    section.rankDrops.length > 0 ||
    section.rankImprovements.length > 0 ||
    section.rankMilestones.length > 0 ||
    section.firstRankings.length > 0 ||
    section.overtakes.length > 0 ||
    section.serpEntrants.length > 0 ||
    section.changes.length > 0 ||
    section.negativeReviews.length > 0 ||
    section.actions.length > 0 ||
    section.competitors.length > 0
  );
}

export function filterBatch(
  batch: AlertBatchPayload,
  allowed: Set<string>,
  confirmDrops = false,
): AlertBatchPayload | null {
  const events = batch.events.filter(
    (event) => allowed.has(event.event) && reachesChannel(event, confirmDrops),
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
      serpEntrants:
        batch.scope === 'owned_apps' && allowed.has('serp.entrant')
          ? section.serpEntrants
          : [],
      changes:
        batch.scope === 'owned_apps' && allowed.has('metadata.changed')
          ? section.changes
          : [],
      negativeReviews:
        batch.scope === 'owned_apps' && allowed.has('review.negative')
          ? section.negativeReviews
          : [],
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
