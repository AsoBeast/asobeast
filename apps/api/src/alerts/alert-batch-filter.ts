import {
  AlertBatchAppSection,
  AlertBatchCompetitorSection,
  AlertBatchPayload,
  GranularAlertPayload,
} from '@asobeast/shared';
import { reachesChannel } from './confirm-drops';
import { withRatingDropsAtLeast } from './rating-routing';
import { reviewGate } from './review-routing';

const allowedOf = <T extends GranularAlertPayload>(
  list: readonly T[],
  allowed: ReadonlySet<string>,
): T[] => list.filter((payload) => allowed.has(payload.event));

function competitorsAllowed(
  competitors: readonly AlertBatchCompetitorSection[],
  allowed: ReadonlySet<string>,
): AlertBatchCompetitorSection[] {
  return competitors.flatMap((competitor) => {
    const changes = allowed.has('metadata.changed') ? competitor.changes : [];
    const availability = allowedOf(competitor.availability ?? [], allowed);
    if (changes.length === 0 && availability.length === 0) return [];
    return [
      {
        app: competitor.app,
        changes,
        ...(availability.length > 0 ? { availability } : {}),
      },
    ];
  });
}

function sectionHasContent(section: AlertBatchAppSection): boolean {
  return (
    (section.availability ?? []).length > 0 ||
    section.rankDrops.length > 0 ||
    section.rankImprovements.length > 0 ||
    section.rankMilestones.length > 0 ||
    section.firstRankings.length > 0 ||
    section.overtakes.length > 0 ||
    (section.chartMoves ?? []).length > 0 ||
    section.serpEntrants.length > 0 ||
    section.changes.length > 0 ||
    (section.ratingDrops ?? []).length > 0 ||
    section.negativeReviews.length > 0 ||
    (section.newReviews ?? []).length > 0 ||
    (section.reviewSpikes ?? []).length > 0 ||
    section.actions.length > 0 ||
    section.competitors.length > 0
  );
}

export interface BatchFilterOptions {
  reviewScores?: readonly number[];
  confirmDrops?: boolean;
  ratingDropTenths?: number | null;
}

export function filterBatch(
  input: AlertBatchPayload,
  allowed: Set<string>,
  options: BatchFilterOptions = {},
): AlertBatchPayload | null {
  const { reviewScores = [], confirmDrops = false } = options;
  const batch = withRatingDropsAtLeast(input, options.ratingDropTenths);
  const keeps = reviewGate(batch.events, allowed, reviewScores);
  const events = batch.events.filter(
    (event) => keeps(event) && reachesChannel(event, confirmDrops),
  );
  const ownedOnly = <T extends GranularAlertPayload>(
    event: GranularAlertPayload['event'],
    list: T[],
  ): T[] =>
    batch.scope === 'owned_apps' && allowed.has(event)
      ? list.filter((payload) => reachesChannel(payload, confirmDrops))
      : [];
  const apps = batch.apps
    .map((section): AlertBatchAppSection => ({
      app: section.app,
      availability:
        batch.scope === 'owned_apps'
          ? allowedOf(section.availability ?? [], allowed)
          : [],
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
      ratingDrops: ownedOnly('rating.dropped', section.ratingDrops ?? []),
      negativeReviews: ownedOnly(
        'review.negative',
        section.negativeReviews,
      ).filter(keeps),
      newReviews: ownedOnly('review.new', section.newReviews ?? []).filter(
        keeps,
      ),
      reviewSpikes: ownedOnly('review.spike', section.reviewSpikes ?? []),
      actions:
        batch.scope === 'owned_apps' && allowed.has('action.opened')
          ? section.actions
          : [],
      competitors:
        batch.scope === 'competitors'
          ? competitorsAllowed(section.competitors, allowed)
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
