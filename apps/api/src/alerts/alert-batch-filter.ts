import { AlertBatchAppSection, AlertBatchPayload } from '@asobeast/shared';

function sectionHasContent(section: AlertBatchAppSection): boolean {
  return (
    section.rankDrops.length > 0 ||
    section.rankImprovements.length > 0 ||
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
): AlertBatchPayload | null {
  const events = batch.events.filter((event) => allowed.has(event.event));
  const apps = batch.apps
    .map((section): AlertBatchAppSection => ({
      app: section.app,
      rankDrops:
        batch.scope === 'owned_apps' && allowed.has('rank.dropped')
          ? section.rankDrops
          : [],
      rankImprovements:
        allowed.has('rank.improved') && batch.scope === 'owned_apps'
          ? section.rankImprovements
          : [],
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
