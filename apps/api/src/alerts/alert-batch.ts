import {
  ACTION_PRIORITIES,
  ActionOpenedPayload,
  AlertBatchApp,
  AppAvailabilityPayload,
  AlertBatchAppSection,
  AlertBatchCompetitorSection,
  AlertBatchPayload,
  AlertBatchScope,
  ChartMovePayload,
  GranularAlertPayload,
  isAvailabilityPayload,
  isChartMovePayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankFirstPayload,
  RankImprovedPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
  RatingDroppedPayload,
  ReviewNegativePayload,
  ReviewNewPayload,
  ReviewSpikePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { byImpact, type KeywordTraffic } from './rank-impact';

export interface ResolvedApp {
  id: string;
  name: string | null;
  iconUrl: string | null;
  store: AlertBatchApp['store'];
  country: string;
  isCompetitor: boolean;
  primaryAppId: string | null;
}

export interface OutboxEvent {
  id?: string;
  event: string;
  appId: string | null;
  payload: GranularAlertPayload;
  createdAt: Date;
}

export interface AssembleInput {
  events: OutboxEvent[];
  appById: Map<string, ResolvedApp>;
  serpPrimariesByKeyword: Map<string, string[]>;
  now: Date;
  traffic?: KeywordTraffic;
}

export const BATCH_SKIP_REASONS = [
  'app_mismatch',
  'unresolved_app',
  'competitor_owned_signal',
  'orphan_competitor',
  'unresolved_primary',
  'invalid_primary',
  'serp_without_primary',
  'unsupported_event',
] as const;

export type BatchSkipReason = (typeof BATCH_SKIP_REASONS)[number];
export type BatchSkippedCounts = Record<BatchSkipReason, number>;

export interface ClassifiedOwnedSignal {
  event: OutboxEvent;
  primaries: ResolvedApp[];
}

export interface ClassifiedCompetitorSignal {
  event: OutboxEvent;
  competitor: ResolvedApp;
  primary: ResolvedApp;
}

export interface ClassifiedInvalidSignal {
  event: OutboxEvent;
  reason: BatchSkipReason;
}

export interface BatchClassification {
  owned: ClassifiedOwnedSignal[];
  competitors: ClassifiedCompetitorSignal[];
  invalid: ClassifiedInvalidSignal[];
  skipped: BatchSkippedCounts;
}

export interface AssembledBatches {
  owned: AlertBatchPayload;
  competitors: AlertBatchPayload;
  skipped: BatchSkippedCounts;
}

interface MutableSection {
  app: AlertBatchApp;
  availability: AppAvailabilityPayload[];
  rankDrops: RankDroppedPayload[];
  rankImprovements: RankImprovedPayload[];
  rankMilestones: RankMilestonePayload[];
  firstRankings: RankFirstPayload[];
  overtakes: RankOvertakenPayload[];
  chartMoves: ChartMovePayload[];
  serpEntrants: SerpEntrantPayload[];
  changes: MetadataChangedPayload[];
  ratingDrops: RatingDroppedPayload[];
  negativeReviews: ReviewNegativePayload[];
  newReviews: ReviewNewPayload[];
  reviewSpikes: ReviewSpikePayload[];
  actions: ActionOpenedPayload[];
  competitors: Map<string, AlertBatchCompetitorSection>;
}

function toBatchApp(app: ResolvedApp): AlertBatchApp {
  return {
    id: app.id,
    name: app.name,
    iconUrl: app.iconUrl,
    store: app.store,
    country: app.country,
  };
}

function compareNames(
  left: { id: string; name: string | null },
  right: { id: string; name: string | null },
): number {
  if (left.name === null && right.name !== null) return 1;
  if (left.name !== null && right.name === null) return -1;
  const name = (left.name ?? '').localeCompare(right.name ?? '', 'en', {
    sensitivity: 'base',
  });
  return name || left.id.localeCompare(right.id);
}

export function compareResolvedApps(
  left: ResolvedApp,
  right: ResolvedApp,
): number {
  return compareNames(left, right);
}

export function compareOutboxEvents(
  left: OutboxEvent,
  right: OutboxEvent,
): number {
  const createdAt = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAt !== 0) return createdAt;
  if (left.id && right.id) return left.id.localeCompare(right.id);
  return 0;
}

function emptySkippedCounts(): BatchSkippedCounts {
  return {
    app_mismatch: 0,
    unresolved_app: 0,
    competitor_owned_signal: 0,
    orphan_competitor: 0,
    unresolved_primary: 0,
    invalid_primary: 0,
    serp_without_primary: 0,
    unsupported_event: 0,
  };
}

function addInvalid(
  result: BatchClassification,
  event: OutboxEvent,
  reason: BatchSkipReason,
): void {
  result.invalid.push({ event, reason });
  result.skipped[reason] += 1;
}

function resolveEventApp(
  event: OutboxEvent,
  appById: Map<string, ResolvedApp>,
  result: BatchClassification,
): ResolvedApp | null {
  if (!('app' in event.payload) || event.appId !== event.payload.app.id) {
    addInvalid(result, event, 'app_mismatch');
    return null;
  }
  const app = appById.get(event.appId);
  if (!app) {
    addInvalid(result, event, 'unresolved_app');
    return null;
  }
  return app;
}

function classifyScoped(
  event: OutboxEvent,
  app: ResolvedApp,
  appById: Map<string, ResolvedApp>,
  result: BatchClassification,
): void {
  if (!app.isCompetitor) {
    result.owned.push({ event, primaries: [app] });
    return;
  }
  if (!app.primaryAppId) {
    addInvalid(result, event, 'orphan_competitor');
    return;
  }
  const primary = appById.get(app.primaryAppId);
  if (!primary) {
    addInvalid(result, event, 'unresolved_primary');
    return;
  }
  if (primary.isCompetitor) {
    addInvalid(result, event, 'invalid_primary');
    return;
  }
  result.competitors.push({ event, competitor: app, primary });
}

function classifyAppEvent(
  event: OutboxEvent,
  appById: Map<string, ResolvedApp>,
  result: BatchClassification,
): void {
  const app = resolveEventApp(event, appById, result);
  if (!app) return;
  if (
    event.payload.event === 'metadata.changed' ||
    isAvailabilityPayload(event.payload)
  ) {
    classifyScoped(event, app, appById, result);
    return;
  }
  if (app.isCompetitor) {
    addInvalid(result, event, 'competitor_owned_signal');
    return;
  }
  result.owned.push({ event, primaries: [app] });
}

function classifySerp(
  event: OutboxEvent,
  input: Pick<AssembleInput, 'appById' | 'serpPrimariesByKeyword'>,
  result: BatchClassification,
): void {
  if (event.payload.event !== 'serp.entrant') return;
  const primaryIds = new Set(
    input.serpPrimariesByKeyword.get(event.payload.keyword.id) ?? [],
  );
  if (primaryIds.size === 0) {
    addInvalid(result, event, 'serp_without_primary');
    return;
  }
  const primaries: ResolvedApp[] = [];
  for (const primaryId of primaryIds) {
    const primary = input.appById.get(primaryId);
    if (!primary) addInvalid(result, event, 'unresolved_primary');
    else if (primary.isCompetitor) addInvalid(result, event, 'invalid_primary');
    else primaries.push(primary);
  }
  if (primaries.length > 0) {
    primaries.sort(compareResolvedApps);
    result.owned.push({ event, primaries });
  }
}

export function classifyBatch(
  input: Pick<AssembleInput, 'events' | 'appById' | 'serpPrimariesByKeyword'>,
): BatchClassification {
  const result: BatchClassification = {
    owned: [],
    competitors: [],
    invalid: [],
    skipped: emptySkippedCounts(),
  };
  const events = [...input.events].sort(compareOutboxEvents);
  for (const event of events) {
    if (event.payload.event === 'serp.entrant')
      classifySerp(event, input, result);
    else if (event.payload.event === 'digest.weekly') {
      addInvalid(result, event, 'unsupported_event');
    } else classifyAppEvent(event, input.appById, result);
  }
  return result;
}

function createSection(app: ResolvedApp): MutableSection {
  return {
    app: toBatchApp(app),
    availability: [],
    rankDrops: [],
    rankImprovements: [],
    rankMilestones: [],
    firstRankings: [],
    overtakes: [],
    chartMoves: [],
    serpEntrants: [],
    changes: [],
    ratingDrops: [],
    negativeReviews: [],
    newReviews: [],
    reviewSpikes: [],
    actions: [],
    competitors: new Map(),
  };
}

function sectionFor(
  sections: Map<string, MutableSection>,
  app: ResolvedApp,
): MutableSection {
  const existing = sections.get(app.id);
  if (existing) return existing;
  const section = createSection(app);
  sections.set(app.id, section);
  return section;
}

function addOwnedSignal(
  sections: Map<string, MutableSection>,
  signal: ClassifiedOwnedSignal,
): void {
  for (const primary of signal.primaries) {
    const section = sectionFor(sections, primary);
    const payload = signal.event.payload;
    if (isAvailabilityPayload(payload)) section.availability.push(payload);
    else if (payload.event === 'rank.dropped') section.rankDrops.push(payload);
    else if (payload.event === 'rank.improved') {
      section.rankImprovements.push(payload);
    } else if (payload.event === 'rank.milestone') {
      section.rankMilestones.push(payload);
    } else if (payload.event === 'rank.first') {
      section.firstRankings.push(payload);
    } else if (payload.event === 'rank.overtaken') {
      section.overtakes.push(payload);
    } else if (isChartMovePayload(payload)) {
      section.chartMoves.push(payload);
    } else if (payload.event === 'serp.entrant') {
      section.serpEntrants.push(payload);
    } else if (payload.event === 'metadata.changed') {
      section.changes.push(payload);
    } else if (payload.event === 'review.negative') {
      section.negativeReviews.push(payload);
    } else if (payload.event === 'review.new') {
      section.newReviews.push(payload);
    } else if (payload.event === 'rating.dropped') {
      section.ratingDrops.push(payload);
    } else if (payload.event === 'review.spike') {
      section.reviewSpikes.push(payload);
    } else if (payload.event === 'action.opened') {
      section.actions.push(payload);
    }
  }
}

function addCompetitorSignal(
  sections: Map<string, MutableSection>,
  signal: ClassifiedCompetitorSignal,
): void {
  const section = sectionFor(sections, signal.primary);
  let competitor = section.competitors.get(signal.competitor.id);
  if (!competitor) {
    competitor = { app: toBatchApp(signal.competitor), changes: [] };
    section.competitors.set(signal.competitor.id, competitor);
  }
  const { payload } = signal.event;
  if (payload.event === 'metadata.changed') {
    competitor.changes.push(payload);
  } else if (isAvailabilityPayload(payload)) {
    competitor.availability = [...(competitor.availability ?? []), payload];
  }
}

function compareActions(
  left: ActionOpenedPayload,
  right: ActionOpenedPayload,
): number {
  return (
    ACTION_PRIORITIES.indexOf(left.action.priority) -
      ACTION_PRIORITIES.indexOf(right.action.priority) ||
    right.action.impact - left.action.impact
  );
}

function compareSections(
  left: { app: AlertBatchApp },
  right: { app: AlertBatchApp },
): number {
  return compareNames(left.app, right.app);
}

function finalizeSections(
  sections: Map<string, MutableSection>,
): AlertBatchAppSection[] {
  return [...sections.values()]
    .map((section): AlertBatchAppSection => ({
      app: section.app,
      availability: section.availability,
      rankDrops: section.rankDrops,
      rankImprovements: section.rankImprovements,
      rankMilestones: section.rankMilestones,
      firstRankings: section.firstRankings,
      overtakes: section.overtakes,
      chartMoves: section.chartMoves,
      serpEntrants: section.serpEntrants,
      changes: section.changes,
      ratingDrops: section.ratingDrops,
      negativeReviews: section.negativeReviews,
      newReviews: section.newReviews,
      reviewSpikes: section.reviewSpikes,
      actions: [...section.actions].sort(compareActions),
      competitors: [...section.competitors.values()].sort(compareSections),
    }))
    .sort(compareSections);
}

function assembleScope(
  scope: AlertBatchScope,
  signals: Array<ClassifiedOwnedSignal | ClassifiedCompetitorSignal>,
  sections: Map<string, MutableSection>,
  now: Date,
): AlertBatchPayload {
  const events = signals.map(({ event }) => event.payload);
  const appCount =
    scope === 'owned_apps'
      ? sections.size
      : new Set(
          signals.flatMap((signal) =>
            'competitor' in signal ? [signal.competitor.id] : [],
          ),
        ).size;
  const from = signals[0]?.event.createdAt.toISOString() ?? now.toISOString();

  return {
    event: 'alerts.batch',
    scope,
    occurredAt: now.toISOString(),
    window: { from, to: now.toISOString() },
    totals: { events: events.length, apps: appCount },
    apps: finalizeSections(sections),
    events,
  };
}

function withMovesByImpact(
  batch: AlertBatchPayload,
  traffic: KeywordTraffic | undefined,
): AlertBatchPayload {
  if (!traffic) return batch;
  return {
    ...batch,
    apps: batch.apps.map((section) => ({
      ...section,
      rankDrops: byImpact(section.rankDrops, traffic),
      rankImprovements: byImpact(section.rankImprovements, traffic),
      rankMilestones: byImpact(section.rankMilestones, traffic),
      firstRankings: byImpact(section.firstRankings, traffic),
      overtakes: byImpact(section.overtakes, traffic),
    })),
  };
}

export function assembleBatches(input: AssembleInput): AssembledBatches {
  const events = [...input.events].sort(compareOutboxEvents);
  const classification = classifyBatch({ ...input, events });
  const ownedSections = new Map<string, MutableSection>();
  const competitorSections = new Map<string, MutableSection>();
  classification.owned.forEach((signal) =>
    addOwnedSignal(ownedSections, signal),
  );
  classification.competitors.forEach((signal) =>
    addCompetitorSignal(competitorSections, signal),
  );
  return {
    owned: withMovesByImpact(
      assembleScope(
        'owned_apps',
        classification.owned,
        ownedSections,
        input.now,
      ),
      input.traffic,
    ),
    competitors: assembleScope(
      'competitors',
      classification.competitors,
      competitorSections,
      input.now,
    ),
    skipped: classification.skipped,
  };
}

export { filterBatch } from './alert-batch-filter';
