import {
  effectiveRun,
  RUN_UNFINISHED_MESSAGE,
  StoredRun,
} from './audit-run-state';

const NOW = new Date('2026-09-17T14:00:00.000Z');
const EARLIER = new Date('2026-09-17T13:50:00.000Z');

const minutesAgo = (minutes: number): Date =>
  new Date(NOW.getTime() - minutes * 60_000);

const run = (overrides: Partial<StoredRun>): StoredRun => ({
  runState: 'completed',
  runError: null,
  requestedAt: null,
  generatedAt: null,
  ...overrides,
});

describe('effectiveRun', () => {
  it.each([
    [null, null],
    [run({ runState: 'queued', requestedAt: minutesAgo(9) }), 'queued'],
    [run({ runState: 'running', requestedAt: minutesAgo(9) }), 'running'],
    [run({ runState: 'running', requestedAt: minutesAgo(11) }), 'failed'],
    [run({ runState: 'completed', generatedAt: EARLIER }), 'completed'],
    [
      run({
        runState: 'failed',
        runError: 'OpenAI rejected the API key. Check OPENAI_API_KEY.',
      }),
      'failed',
    ],
  ])('reads %j as %s', (stored, state) => {
    expect(effectiveRun(stored, NOW)?.state ?? null).toBe(state);
  });

  it('explains a run that never finished', () => {
    expect(
      effectiveRun(
        run({ runState: 'queued', requestedAt: minutesAgo(11) }),
        NOW,
      )?.error,
    ).toBe(RUN_UNFINISHED_MESSAGE);
  });

  it('reports the finished timestamp of a completed run', () => {
    expect(
      effectiveRun(run({ runState: 'completed', generatedAt: EARLIER }), NOW),
    ).toEqual({
      state: 'completed',
      requestedAt: null,
      finishedAt: EARLIER.toISOString(),
      error: null,
    });
  });
});
