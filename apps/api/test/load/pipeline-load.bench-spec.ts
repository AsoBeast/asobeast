import {
  createPipelineHarness,
  type PipelineHarness,
} from '../helpers/pipeline-harness';
import { SCALE_SHAPES, Scale } from './fixture';
import { DEGRADATION_ORDER } from '../../src/jobs/degradation';
import {
  reportBenchmark,
  runBenchmark,
  type BenchmarkResult,
} from './benchmark';

const SCALE = (process.env.BENCH_SCALE ?? 'small') as Scale;
const ORCHESTRATION_BUDGET_MS = Number(
  process.env.BENCH_MAX_FANOUT_MS ?? 60_000,
);

describe(`Daily pipeline orchestration cost at the ${SCALE} scale`, () => {
  jest.setTimeout(900_000);

  let harness: PipelineHarness;
  let result: BenchmarkResult;

  beforeAll(async () => {
    harness = await createPipelineHarness();
    result = await runBenchmark(
      {
        prisma: harness.prisma,
        pipeline: harness.pipeline,
        budget: harness.budget,
        queue: harness.queue,
        asWorkspace: harness.asWorkspace,
      },
      SCALE,
    );
    reportBenchmark(result);
  });

  afterAll(() => harness.close());

  it('builds the fixture the scale describes', () => {
    const shape = SCALE_SHAPES[SCALE];
    expect(result.fixture.apps).toBe(shape.apps);
    expect(result.fixture.trackedKeywords).toBe(
      shape.apps * shape.keywordsPerApp * shape.countries.length,
    );
    expect(result.fixture.rankings).toBe(
      result.fixture.trackedKeywords * shape.historyDays,
    );
  });

  it('enqueues one job for every unit of work it did not shed', () => {
    expect(result.enqueued).toBe(
      result.summary.apps +
        result.summary.keywords +
        result.summary.categories +
        result.summary.reviews,
    );
  });

  it('runs every stage the budget planned, or sheds it in the documented order', () => {
    const planned = DEGRADATION_ORDER.filter(
      (stage) => result.budget[stage] > 0,
    );
    expect(planned.slice(0, result.shed.length)).toEqual(result.shed);

    for (const stage of planned) {
      if (result.shed.includes(stage)) continue;
      expect(result.summary[stage]).toBe(result.budget[stage]);
    }
  });

  it('prices the day in requests rather than in jobs', () => {
    expect(result.budget.total).toBe(
      result.projections.reduce(
        (total, projection) => total + projection.requests,
        0,
      ),
    );
  });

  it('counts every tracked market as its own search', () => {
    const shape = SCALE_SHAPES[SCALE];
    expect(result.summary.keywords).toBe(
      shape.apps * shape.keywordsPerApp * shape.countries.length,
    );
  });

  it('keeps orchestration cost inside its guard', () => {
    expect(result.fanOutMs).toBeLessThan(ORCHESTRATION_BUDGET_MS);
  });

  it('projects a wall clock for every store the budget reports', () => {
    expect(result.projections).toHaveLength(result.budget.stores.length);
    for (const projection of result.projections) {
      expect(projection.rpm).toBeGreaterThan(0);
      expect(projection.hours).toBeGreaterThanOrEqual(0);
    }
  });
});
