import { aiCallCutoff, aiPeriodOf, secondsUntil } from './ai-period';

const at = (iso: string) => new Date(iso);

describe('aiPeriodOf', () => {
  it('starts the period at 00:00 UTC on the 1st', () => {
    expect(aiPeriodOf(at('2026-10-17T13:45:00.000Z'))).toEqual({
      start: at('2026-10-01T00:00:00.000Z'),
      resetsAt: at('2026-11-01T00:00:00.000Z'),
    });
  });

  it('puts the first instant of a month in that month', () => {
    expect(aiPeriodOf(at('2026-11-01T00:00:00.000Z')).start).toEqual(
      at('2026-11-01T00:00:00.000Z'),
    );
  });

  it('puts the last millisecond of a month in that month', () => {
    expect(aiPeriodOf(at('2026-10-31T23:59:59.999Z')).resetsAt).toEqual(
      at('2026-11-01T00:00:00.000Z'),
    );
  });

  it('renews december on 1 january of the next year', () => {
    expect(aiPeriodOf(at('2026-12-31T08:00:00.000Z')).resetsAt).toEqual(
      at('2027-01-01T00:00:00.000Z'),
    );
  });

  it('renews a leap february on 1 march', () => {
    expect(aiPeriodOf(at('2028-02-29T12:00:00.000Z')).resetsAt).toEqual(
      at('2028-03-01T00:00:00.000Z'),
    );
  });
});

describe('secondsUntil', () => {
  it('counts at least one second until the renewal', () => {
    expect(
      secondsUntil(
        at('2026-11-01T00:00:00.000Z'),
        at('2026-10-31T23:59:59.999Z'),
      ),
    ).toBe(1);
    expect(
      secondsUntil(
        at('2026-11-01T00:00:00.000Z'),
        at('2026-10-31T00:00:00.000Z'),
      ),
    ).toBe(86_400);
  });
});

describe('aiCallCutoff', () => {
  it('prunes before the retention cutoff', () => {
    expect(
      aiCallCutoff(
        at('2025-09-01T00:00:00.000Z'),
        at('2026-10-17T00:00:00.000Z'),
      ),
    ).toEqual(at('2025-09-01T00:00:00.000Z'));
  });

  it('never prunes into the current month', () => {
    expect(
      aiCallCutoff(
        at('2026-10-16T00:00:00.000Z'),
        at('2026-10-17T00:00:00.000Z'),
      ),
    ).toEqual(at('2026-10-01T00:00:00.000Z'));
  });
});
