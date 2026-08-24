import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FanOutSummary, Store, STORES } from '@asobeast/shared';
import { FlowJobNode, FlowProducer, Queue } from 'bullmq';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { QuotaService } from '../auth/quota.service';
import { TrackedKeywordAccess } from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import {
  categoryJobId,
  dailyCompleteJobId,
  DailyCompletePayload,
  FLOW_PRODUCERS,
  isoWeekKey,
  JOBS,
  QUEUES,
  queueNameForStore,
  reviewsJobId,
  scoreJobId,
  utcDateKey,
} from './jobs.types';
import { JOB_OPTIONS } from './job-options';
import { ActiveWorkspaces } from './active-workspaces';
import { DailyCapacity } from './daily-capacity.service';
import {
  AppTarget,
  DailyTargets,
  DailyTargetsCollector,
  dedupeBuckets,
  dedupeKeywords,
} from './daily-targets.service';
import { DailyStage, DegradationPlan, planDegradation } from './degradation';
import { interleave } from './interleave';
import { applyKeywordLimit } from './over-limit';
import { OverLimitRegistry } from './over-limit.registry';
import { requestsPerJob } from './request-weights';

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
        opts: childOptions(`daily~refresh~${app.id}~${date}`),
      })),
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
        opts: childOptions(`daily~${reviewsJobId(app.id, date)}`),
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
        isCompetitor: true,
        competitors: { select: { id: true, store: true } },
        tracked: {
          where: { active: true },
          select: { keywordId: true, keyword: { select: { store: true } } },
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

    return this.enqueue({ apps, keywords, reviewApps }, app.workspaceId);
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
    const { results, failures } = await this.fanOut.each(
      'weekly scoring visits every workspace that tracks a phrase',
      () => this.scoreWorkspaceKeywords(),
    );
    const total = results.reduce((sum, count) => sum + count, 0);
    this.logger.log(`fan out scoring ${total}`);
    const failure = workspaceFailure(
      failures,
      'failed to schedule its scoring',
    );
    if (failure) throw failure;
    return total;
  }

  private async scoreWorkspaceKeywords(): Promise<number> {
    const scope = this.workspace.scopeFor('weekly scoring');
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true },
      select: { keywordId: true, keyword: { select: { store: true } } },
      distinct: ['keywordId'],
    });

    const week = isoWeekKey();
    for (const { keywordId, keyword } of keywords) {
      await this.queueFor(keyword.store).add(
        JOBS.SCORE_KEYWORD,
        { keywordId, ...scope },
        { jobId: scoreJobId(keywordId, week) },
      );
    }
    return keywords.length;
  }

  async enqueueScore(keywordId: string): Promise<void> {
    const keyword = await this.trackedKeywords.require(keywordId);
    await this.queueFor(keyword.store).add(
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

    for (const app of targets.apps) {
      await this.queueFor(app.store).add(
        JOBS.REFRESH_APP,
        { appId: app.id, ...scope },
        { jobId: `refresh~${app.id}~${date}` },
      );
    }
    for (const keyword of targets.keywords) {
      await this.queueFor(keyword.store).add(
        JOBS.CHECK_KEYWORD,
        { keywordId: keyword.keywordId, ...scope },
        { jobId: `check~${keyword.keywordId}~${date}` },
      );
    }
    for (const app of targets.reviewApps) {
      await this.queueFor(app.store).add(
        JOBS.SYNC_REVIEWS,
        {
          appId: app.id,
          pages: 1,
          backfill: false,
          ...scope,
        },
        { jobId: reviewsJobId(app.id, date) },
      );
    }

    const buckets = await this.categoryRanks.buckets(
      targets.apps.map((app) => app.id),
    );
    for (const bucket of buckets) {
      await this.queueFor(bucket.store).add(
        JOBS.CHECK_CATEGORY,
        { ...bucket, ...scope },
        {
          jobId: categoryJobId(
            workspaceId,
            bucket.collection,
            bucket.genre,
            bucket.country,
            date,
          ),
        },
      );
    }

    const summary: FanOutSummary = {
      apps: targets.apps.length,
      keywords: targets.keywords.length,
      categories: buckets.length,
      reviews: targets.reviewApps.length,
    };
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

function countStages(children: FlowJobNode[]): FanOutSummary {
  const summary: FanOutSummary = {
    apps: 0,
    keywords: 0,
    categories: 0,
    reviews: 0,
  };
  for (const child of children) {
    summary[stageOf(child.name)] += 1;
  }
  return summary;
}
