import {
  INSPECTION_NEVER_STARTED,
  INSPECTION_PENDING_TTL_MS,
  INSPECTION_QUEUE_LIMIT_MS,
  INSPECTION_TIMED_OUT,
  staleFailureOf,
} from './inspection-failures';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const ago = (ms: number): Date => new Date(NOW - ms);

describe('staleFailureOf', () => {
  it('leaves a run that started within the timeout pending', () => {
    expect(
      staleFailureOf(
        { status: 'PENDING', requestedAt: ago(60_000), startedAt: ago(1_000) },
        NOW,
      ),
    ).toBeNull();
  });

  it('times out a run that started longer ago than the timeout', () => {
    const started = ago(INSPECTION_PENDING_TTL_MS + 1);
    expect(
      staleFailureOf(
        { status: 'PENDING', requestedAt: started, startedAt: started },
        NOW,
      ),
    ).toBe(INSPECTION_TIMED_OUT);
  });

  it('leaves a run that waits in the queue within the queue limit pending', () => {
    expect(
      staleFailureOf(
        {
          status: 'PENDING',
          requestedAt: ago(INSPECTION_QUEUE_LIMIT_MS - 1),
          startedAt: null,
        },
        NOW,
      ),
    ).toBeNull();
  });

  it('fails a run that never started within the queue limit', () => {
    expect(
      staleFailureOf(
        {
          status: 'PENDING',
          requestedAt: ago(INSPECTION_QUEUE_LIMIT_MS + 1),
          startedAt: null,
        },
        NOW,
      ),
    ).toBe(INSPECTION_NEVER_STARTED);
  });

  it('never rewrites a finished run', () => {
    const old = ago(INSPECTION_QUEUE_LIMIT_MS + 1);
    expect(
      staleFailureOf(
        { status: 'DONE', requestedAt: old, startedAt: null },
        NOW,
      ),
    ).toBeNull();
  });
});
