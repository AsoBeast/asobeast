import { DailyBudget, FanOutSummary } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { DailyBudgetService } from '../../src/jobs/daily-budget.service';
import { PipelineService } from '../../src/jobs/pipeline.service';
import { QUEUES } from '../../src/jobs/jobs.types';
import { DEGRADATION_ORDER, type DailyStage } from '../../src/jobs/degradation';
import { PrismaClient } from '@prisma/client';
import {
  clearFixture,
  loadFixture,
  LoadFixtureSummary,
  Scale,
} from './fixture';

const MINUTES_PER_DAY = 60 * 24;

export const WINDOW_HOURS = 24;

export interface QueueDepth {
  queue: string;
  jobs: number;
}

export interface StoreProjection {
  store: string;
  requests: number;
  rpm: number;
  hours: number;
  fitsWindow: boolean;
}

export interface BenchmarkResult {
  scale: Scale;
  fixture: LoadFixtureSummary;
  fixtureMs: number;
  budgetMs: number;
  fanOutMs: number;
  summary: FanOutSummary;
  budget: DailyBudget;
  depths: QueueDepth[];
  enqueued: number;
  projections: StoreProjection[];
  shed: DailyStage[];
  redisBytesDelta: number;
}

export interface BenchmarkContext {
  prisma: PrismaClient;
  pipeline: PipelineService;
  budget: DailyBudgetService;
  queue: (name: string) => Queue;
  asWorkspace: <T>(work: () => Promise<T>) => Promise<T>;
}

async function usedMemory(queue: Queue): Promise<number> {
  const client = (await queue.getBackend().client) as unknown as {
    info(section: string): Promise<string>;
  };
  const match = /used_memory:(\d+)/.exec(await client.info('memory'));
  return match ? Number(match[1]) : 0;
}

async function timed<T>(work: () => Promise<T>): Promise<[T, number]> {
  const started = process.hrtime.bigint();
  const result = await work();
  return [result, Number(process.hrtime.bigint() - started) / 1_000_000];
}

function projectionsFor(budget: DailyBudget): StoreProjection[] {
  return budget.stores.map((store) => {
    const rpm = store.capacityPerDay / MINUTES_PER_DAY;
    const hours = rpm > 0 ? store.total / rpm / 60 : 0;
    return {
      store: store.store,
      requests: store.total,
      rpm,
      hours,
      fitsWindow: hours <= WINDOW_HOURS,
    };
  });
}

export async function runBenchmark(
  context: BenchmarkContext,
  scale: Scale,
): Promise<BenchmarkResult> {
  await clearFixture(context.prisma);
  const [fixture, fixtureMs] = await timed(() =>
    loadFixture(context.prisma, scale),
  );

  const appStore = context.queue(QUEUES.APP_STORE);
  const redisBefore = await usedMemory(appStore);
  const [budget, budgetMs] = await timed(() =>
    context.asWorkspace(() => context.budget.estimate()),
  );
  const [summary, fanOutMs] = await timed(() => context.pipeline.fanOutDaily());
  const redisAfter = await usedMemory(appStore);

  const depths: QueueDepth[] = [];
  for (const name of [QUEUES.APP_STORE, QUEUES.GPLAY]) {
    const counts = await context
      .queue(name)
      .getJobCounts('wait', 'paused', 'delayed', 'prioritized');
    depths.push({
      queue: name,
      jobs: Object.values(counts).reduce((total, count) => total + count, 0),
    });
  }

  return {
    scale,
    fixture,
    fixtureMs,
    budgetMs,
    fanOutMs,
    summary,
    budget,
    depths,
    enqueued: depths.reduce((total, depth) => total + depth.jobs, 0),
    projections: projectionsFor(budget),
    shed: shedStages(budget, summary),
    redisBytesDelta: redisAfter - redisBefore,
  };
}

export function shedStages(
  budget: DailyBudget,
  summary: FanOutSummary,
): DailyStage[] {
  return DEGRADATION_ORDER.filter(
    (stage) => budget[stage] > 0 && summary[stage] === 0,
  );
}

export function reportBenchmark(result: BenchmarkResult): void {
  const round = (value: number) => Math.round(value * 100) / 100;
  const lines = [
    `scale ${result.scale}`,
    `  fixture      ${result.fixture.apps} apps, ${result.fixture.trackedKeywords} tracked keywords, ${result.fixture.rankings} rankings in ${round(result.fixtureMs)} ms`,
    `  budget query ${round(result.budgetMs)} ms`,
    `  fan-out      ${round(result.fanOutMs)} ms`,
    `  enqueued     ${result.enqueued} jobs (${result.depths
      .map((depth) => `${depth.queue} ${depth.jobs}`)
      .join(', ')})`,
    `  budget total ${result.budget.total}`,
    `  redis delta  ${result.redisBytesDelta} bytes`,
    `  utilization  ${round(result.budget.utilization * 100)}% of a day`,
    `  shed         ${result.shed.length === 0 ? 'nothing' : result.shed.join(', ')}`,
    ...result.projections.map(
      (projection) =>
        `  projected    ${projection.store}: ${projection.requests} requests at ${projection.rpm} rpm is ${round(projection.hours)} hours, ${projection.fitsWindow ? 'inside' : 'past'} the ${WINDOW_HOURS} hour window`,
    ),
  ];
  console.log(lines.join('\n'));
}
