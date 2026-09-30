import { countChangeDays } from './change-days';

const at = (iso: string): Date => new Date(iso);

describe('countChangeDays', () => {
  it('counts the fields found together on one UTC day as one change', () => {
    const counts = countChangeDays([
      { appId: 'app_1', capturedAt: at('2026-09-29T14:44:01.649Z') },
      { appId: 'app_1', capturedAt: at('2026-09-29T14:44:01.649Z') },
    ]);

    expect(counts.get('app_1')).toBe(1);
  });

  it('counts a later UTC day as another change', () => {
    const counts = countChangeDays([
      { appId: 'app_1', capturedAt: at('2026-09-29T14:44:01.649Z') },
      { appId: 'app_1', capturedAt: at('2026-09-27T03:00:00.000Z') },
    ]);

    expect(counts.get('app_1')).toBe(2);
  });

  it('splits at UTC midnight', () => {
    const counts = countChangeDays([
      { appId: 'app_1', capturedAt: at('2026-09-28T23:59:59.999Z') },
      { appId: 'app_1', capturedAt: at('2026-09-29T00:00:00.000Z') },
    ]);

    expect(counts.get('app_1')).toBe(2);
  });

  it('keeps every app apart', () => {
    const counts = countChangeDays([
      { appId: 'app_1', capturedAt: at('2026-09-29T10:00:00.000Z') },
      { appId: 'app_2', capturedAt: at('2026-09-29T10:00:00.000Z') },
    ]);

    expect([...counts]).toEqual([
      ['app_1', 1],
      ['app_2', 1],
    ]);
  });

  it('has nothing to count without events', () => {
    expect(countChangeDays([]).size).toBe(0);
  });
});
