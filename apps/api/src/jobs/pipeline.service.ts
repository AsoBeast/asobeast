import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CURRENT_FORMULA_VERSIONS,
  FanOutSummary,
  Store,
  STORES,
} from '@asobeast/shared';
import { FlowJobNode, FlowProducer, JobsOptions, Queue } from 'bullmq';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { QuotaService } from '../auth/quota.service';
import { TrackedKeywordAccess } from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import {
  categoryJobId,
  checkJobId,
  dailyCompleteJobId,
  DailyCompletePayload,
  FLOW_PRODUCERS,
  isoWeekKey,
  JOBS,
  QUEUES,
  queueNameForStore,
  refreshJobId,
  reviewsJobId,
  scoreJobId,
  utcDateKey,
} from './jobs.types';
import { JOB_OPTIONS, reviewSyncJobOptions } from './job-options';
import { ActiveWorkspaces } from './active-workspaces';
import { enqueueReplacingFailed } from './enqueue-replacing-failed';
import { DailyCapacity } from './daily-capacity.service';
import {
  AppTarget,
  DailyTargets,
  DailyTargetsCollector,
  dedupeBuckets,
  dedupeKeywords,
  MarketListingTarget,
  marketListingTargets,
} from './daily-targets.service';
import { DailyStage, DegradationPlan, planDegradation } from './degradation';
import { interleave } from './interleave';
import { applyKeywordLimit } from './over-limit';
import { OverLimitRegistry } from './over-limit.registry';
import { requestsPerJob } from './request-weights';

interface ManualJob {
  store: Store;
  name: string;
  data: object;
  opts: JobsOptions & { jobId: string };
}

interface ScoringTarget {
  keywordId: string;
  keyword: { store: Store; metrics: Array<{ formulaVersion: string | null }> };
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    @InjectFlowProducer(FLOW_PRODUCERS.DAILY_PIPELINE)
    private readonly flowProducer: FlowProducer,
    private readonly prisma: PrismaService,
    private readonly categoryRanks: CategoryRanksService,
    private readonly targets: DailyTargetsCollector,
    private readonly workspace: WorkspaceContext,
    private readonly fanOut: WorkspaceFanOut,
    private readonly trackedKeywords: TrackedKeywordAccess,
    private readonly activeWorkspaces: ActiveWorkspaces,
    private readonly quota: QuotaService,
    private readonly overLimit: OverLimitRegistry,
    private readonly capacity: DailyCapacity,
  ) {}

  async fanOutDaily(): Promise<FanOutSummary> {
    const date = utcDateKey();
    const { results, failures } = await this.fanOut.eachOf(
      await this.activeWorkspaces.forDailyRun(),
      () => this.dailyChildren(date),
    );
    const planned = dedupeChildren(
      interleave(results.map((batch) => batch.children)),
    );
    const children = await this.shedUnderPressure(planned);
    const summary = countStages(children);
    const payload: DailyCompletePayload = { date, ...summary };

    await this.flowProducer.add(
      {
        name: JOBS.DAILY_COMPLETE,
        queueName: QUEUES.PIPELINE,
        data: payload,
        opts: { ...JOB_OPTIONS, jobId: dailyCompleteJobId(date) },
        children,
      },
      {
        queuesOptions: {
          [QUEUES.PIPELINE]: { defaultJobOptions: JOB_OPTIONS },
          [QUEUES.APP_STORE]: { defaultJobOptions: JOB_OPTIONS },
          [QUEUES.GPLAY]: { defaultJobOptions: JOB_OPTIONS },
        },
      },
    );

    this.logger.log(`fan out ${JSON.stringify(summary)}`);
    const failure = workspaceFailure(
      failures,
      'failed to schedule its daily run',
    );
    if (failure) throw failure;
    return summary;
  }

  private async dailyChildren(
    date: string,
  ): Promise<{ children: FlowJobNode[] }> {
    const scope = this.workspace.scopeFor('the daily fan-out');
    const targets = await this.withinKeywordLimit(await this.targets.collect());
    const buckets = dedupeBuckets(
      await this.categoryRanks.buckets(targets.apps.map((app) => app.id)),
    );
    const childOptions = (jobId: string) => ({
      ...JOB_OPTIONS,
      jobId,
      removeDependencyOnFailure: true,
    });
    const children: FlowJobNode[] = [
      ...targets.apps.map((app) => ({
        name: JOBS.REFRESH_APP,
        queueName: queueNameForStore(app.store),
        data: { appId: app.id, ...scope },
        opts: childOptions(`daily~${refreshJobId(app.id, date)}`),
      })),
      ...this.marketRefreshChildren(
        targets.marketListings,
        scope,
        date,
        childOptions,
      ),
      ...targets.keywords.map((keyword) => ({
        name: JOBS.CHECK_KEYWORD,
        queueName: queueNameForStore(keyword.store),
        data: { keywordId: keyword.keywordId, ...scope },
        opts: childOptions(`daily~check~${keyword.keywordId}~${date}`),
      })),
      ...targets.reviewApps.map((app) => ({
        name: JOBS.SYNC_REVIEWS,
        queueName: queueNameForStore(app.store),
        data: {
          appId: app.id,
          pages: 1,
          backfill: false,
          ...scope,
        },
        opts: {
          ...childOptions(`daily~${reviewsJobId(app.id, date)}`),
          ...reviewSyncJobOptions(app.store),
        },
      })),
      ...buckets.map((bucket) => ({
        name: JOBS.CHECK_CATEGORY,
        queueName: queueNameForStore(bucket.store),
        data: { ...bucket, ...scope },
        opts: childOptions(
          `daily~${categoryJobId(
            scope.workspaceId,
            bucket.collection,
            bucket.genre,
            bucket.country,
            date,
          )}`,
        ),
      })),
    ];

    this.logger.log(
      `fan out ${scope.workspaceId} ${JSON.stringify(countStages(children))}`,
    );
    return { children };
  }

  private marketRefreshChildren(
    listings: readonly MarketListingTarget[],
    scope: WorkspaceScope,
    date: string,
    options: (jobId: string) => JobsOptions & { jobId: string },
  ): FlowJobNode[] {
    return listings.map((listing) => ({
      name: JOBS.REFRESH_APP,
      queueName: queueNameForStore(listing.store),
      data: { appId: listing.id, country: listing.country, ...scope },
      opts: options(`daily~${refreshJobId(listing.id, date, listing.country)}`),
    }));
  }

  private async shedUnderPressure(
    children: FlowJobNode[],
  ): Promise<FlowJobNode[]> {
    const plans = await Promise.all(
      STORES.map(async (store) => ({
        store,
        plan: await this.planFor(store, children),
      })),
    );
    const skipped = new Map(
      plans.map(({ store, plan }) => [store, plan.skipped]),
    );
    if (plans.every(({ plan }) => plan.skipped.length === 0)) return children;

    const kept = children.filter(
      (child) =>
        !skipped
          .get(storeOfQueue(child.queueName))
          ?.includes(stageOf(child.name)),
    );
    for (const { store, plan } of plans) {
      if (plan.skipped.length === 0) continue;
      this.logger.error(
        `daily run degraded ${JSON.stringify({
          store,
          pressure: plan.pressure,
          skipped: plan.skipped,
        })}`,
      );
    }
    this.logger.error(
      `daily run enqueued ${kept.length} of ${children.length} planned jobs`,
    );
    return kept;
  }

  private async planFor(
    store: Store,
    children: FlowJobNode[],
  ): Promise<DegradationPlan> {
    const onStore = children.filter(
      (child) => storeOfQueue(child.queueName) === store,
    );
    return planDegradation({
      demand: requestsForChildren(onStore),
      backlog: await this.backlogOf(store),
      capacityPerDay: await this.capacity.perDay(store),
    });
  }

  private async backlogOf(store: Store): Promise<number> {
    const queue = this.queueFor(store);
    const [waiting, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
    ]);
    return (waiting + delayed) * requestsPerJob(store, BACKLOG_STAGE);
  }

  private async withinKeywordLimit(
    targets: DailyTargets,
  ): Promise<DailyTargets> {
    const limit = await this.quota.limitFor('keywordMarkets');
    if (limit === null) return targets;

    const state = await this.overLimit.state();
    if (targets.keywords.length <= limit) {
      await this.overLimit.recordWithinLimit(state);
      return targets;
    }

    const now = new Date();
    const decision = applyKeywordLimit({
      keywords: targets.keywords,
      limit,
      overLimitSince: state.since,
      now,
    });
    await this.overLimit.recordOverLimit(
      state,
      { used: targets.keywords.length, limit, dropped: decision.dropped },
      now,
    );
    return { ...targets, keywords: decision.covered };
  }

  async fanOutApp(appId: string): Promise<FanOutSummary> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        workspaceId: true,
        store: true,
        country: true,
        isCompetitor: true,
        competitors: { select: { id: true, store: true } },
        tracked: {
          where: { active: true },
          select: {
            keywordId: true,
            keyword: { select: { store: true, country: true } },
          },
        },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const apps: AppTarget[] = [
      { id: app.id, store: app.store },
      ...app.competitors.map((competitor) => ({
        id: competitor.id,
        store: competitor.store,
      })),
    ];
    const keywords = dedupeKeywords(
      app.tracked.map((tracked) => ({
        keywordId: tracked.keywordId,
        store: tracked.keyword.store,
      })),
    );
    const reviewApps: AppTarget[] = app.isCompetitor
      ? []
      : [{ id: app.id, store: app.store }];
    const marketListings = marketListingTargets(
      [
        { id: app.id, store: app.store, primaryAppId: null },
        ...app.competitors.map((rival) => ({
          id: rival.id,
          store: rival.store,
          primaryAppId: app.id,
        })),
      ],
      [...new Set(app.tracked.map((row) => row.keyword.country))]
        .filter((country) => country !== app.country)
        .map((country) => ({ appId: app.id, country })),
    );

    return this.enqueue(
      { apps, keywords, reviewApps, marketListings },
      app.workspaceId,
    );
  }

  async fanOutWorkspaceDaily(workspaceId: string): Promise<FanOutSummary> {
    const { results, failures } = await this.fanOut.eachOf(
      [workspaceId],
      async () =>
        this.enqueue(
          await this.withinKeywordLimit(await this.targets.collect()),
          workspaceId,
        ),
    );
    const failure = workspaceFailure(
      failures,
      'failed to run its daily pipeline',
    );
    if (failure) throw failure;
    return results[0];
  }

  async fanOutScoring(): Promise<number> {
    return this.scoreEveryWorkspace(
      'weekly scoring visits every workspace that tracks a phrase',
      async () => {
        const week = isoWeekKey();
        return this.enqueueScores(
          await this.trackedForScoring(),
          () => week,
          'weekly scoring',
        );
      },
    );
  }

  async fanOutOutdatedScores(): Promise<number> {
    return this.scoreEveryWorkspace(
      'a formula change rescores every workspace that tracks a phrase',
      async () => {
        const tracked = await this.trackedForScoring();
        const outdated = tracked.filter(({ keyword }) => {
          const [latest] = keyword.metrics;
          return (
            latest !== undefined &&
            latest.formulaVersion !== CURRENT_FORMULA_VERSIONS[keyword.store]
          );
        });
        return this.enqueueScores(
          outdated,
          ({ keyword }) => CURRENT_FORMULA_VERSIONS[keyword.store],
          'a formula rescore',
        );
      },
    );
  }

  private async scoreEveryWorkspace(
    justification: string,
    work: () => Promise<number>,
  ): Promise<number> {
    const { results, failures } = await this.fanOut.each(justification, work);
    const total = results.reduce((sum, count) => sum + count, 0);
    this.logger.log(`fan out scoring ${total}`);
    const failure = workspaceFailure(
      failures,
      'failed to schedule its scoring',
    );
    if (failure) throw failure;
    return total;
  }

  private trackedForScoring(): Promise<ScoringTarget[]> {
    return this.prisma.trackedKeyword.findMany({
      where: { active: true },
      distinct: ['keywordId'],
      select: {
        keywordId: true,
        keyword: {
          select: {
            store: true,
            metrics: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { formulaVersion: true },
            },
          },
        },
      },
    });
  }

  private async enqueueScores(
    keywords: ScoringTarget[],
    bucketFor: (target: ScoringTarget) => string,
    reason: string,
  ): Promise<number> {
    const scope = this.workspace.scopeFor(reason);
    for (const target of keywords) {
      await this.queueFor(target.keyword.store).add(
        JOBS.SCORE_KEYWORD,
        { keywordId: target.keywordId, ...scope },
        { jobId: scoreJobId(target.keywordId, bucketFor(target)) },
      );
    }
    return keywords.length;
  }

  async enqueueScore(keywordId: string): Promise<void> {
    const keyword = await this.trackedKeywords.require(keywordId);
    await enqueueReplacingFailed(
      this.queueFor(keyword.store),
      JOBS.SCORE_KEYWORD,
      { keywordId, ...this.workspace.scopeFor('a keyword score') },
      { jobId: scoreJobId(keywordId, utcDateKey()) },
    );
  }

  private async enqueue(
    targets: DailyTargets,
    workspaceId: string,
  ): Promise<FanOutSummary> {
    const date = utcDateKey();
    const scope = { workspaceId, correlationId: this.workspace.correlationId };
    const buckets = await this.categoryRanks.buckets(
      targets.apps.map((app) => app.id),
    );
    const requests: ManualJob[] = [
      ...targets.apps.map((app) => ({
        store: app.store,
        name: JOBS.REFRESH_APP,
        data: { appId: app.id, ...scope },
        opts: { jobId: refreshJobId(app.id, date) },
      })),
      ...targets.marketListings.map((listing) => ({
        store: listing.store,
        name: JOBS.REFRESH_APP,
        data: { appId: listing.id, country: listing.country, ...scope },
        opts: { jobId: refreshJobId(listing.id, date, listing.country) },
      })),
      ...targets.keywords.map((keyword) => ({
        store: keyword.store,
        name: JOBS.CHECK_KEYWORD,
        data: { keywordId: keyword.keywordId, ...scope },
        opts: { jobId: checkJobId(keyword.keywordId, date) },
      })),
      ...targets.reviewApps.map((app) => ({
        store: app.store,
        name: JOBS.SYNC_REVIEWS,
        data: { appId: app.id, pages: 1, backfill: false, ...scope },
        opts: {
          jobId: reviewsJobId(app.id, date),
          ...reviewSyncJobOptions(app.store),
        },
      })),
      ...buckets.map((bucket) => ({
        store: bucket.store,
        name: JOBS.CHECK_CATEGORY,
        data: { ...bucket, ...scope },
        opts: {
          jobId: categoryJobId(
            workspaceId,
            bucket.collection,
            bucket.genre,
            bucket.country,
            date,
          ),
        },
      })),
    ];

    const summary = emptySummary();
    for (const { store, name, data, opts } of requests) {
      if (
        await enqueueReplacingFailed(this.queueFor(store), name, data, opts)
      ) {
        summary[stageOf(name)] += 1;
      }
    }
    this.logger.log(`fan out ${JSON.stringify(summary)}`);
    return summary;
  }

  private queueFor(store: Store): Queue {
    return queueNameForStore(store) === QUEUES.GPLAY
      ? this.gplayQueue
      : this.appStoreQueue;
  }
}

const STAGE_BY_JOB: Record<string, DailyStage> = {
  [JOBS.REFRESH_APP]: 'apps',
  [JOBS.CHECK_KEYWORD]: 'keywords',
  [JOBS.CHECK_CATEGORY]: 'categories',
  [JOBS.SYNC_REVIEWS]: 'reviews',
};

export function dedupeChildren(children: FlowJobNode[]): FlowJobNode[] {
  const claimed = new Set<string>();
  return children.filter((child) => {
    const jobId = child.opts?.jobId;
    if (jobId === undefined) return true;
    const key = `${child.queueName}~${jobId}`;
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  });
}

function stageOf(jobName: string): DailyStage {
  return STAGE_BY_JOB[jobName] ?? 'keywords';
}

const BACKLOG_STAGE: DailyStage = 'keywords';

function storeOfQueue(queueName: string): Store {
  return queueName === QUEUES.GPLAY ? 'GOOGLE_PLAY' : 'APP_STORE';
}

function requestsForChildren(children: FlowJobNode[]): number {
  return children.reduce(
    (total, child) =>
      total +
      requestsPerJob(storeOfQueue(child.queueName), stageOf(child.name)),
    0,
  );
}

function emptySummary(): FanOutSummary {
  return { apps: 0, keywords: 0, categories: 0, reviews: 0 };
}

function countStages(children: FlowJobNode[]): FanOutSummary {
  const summary = emptySummary();
  for (const child of children) {
    summary[stageOf(child.name)] += 1;
  }
  return summary;
}
