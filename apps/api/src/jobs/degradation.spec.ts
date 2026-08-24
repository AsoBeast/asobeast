import { DEGRADATION_ORDER, planDegradation } from './degradation';

const plan = (demand: number, backlog = 0, capacityPerDay = 1_000) =>
  planDegradation({ demand, backlog, capacityPerDay });

describe('planDegradation', () => {
  it('sheds nothing while the day has room', () => {
    expect(plan(500)).toEqual({ pressure: 0.5, skipped: [] });
  });

  it('sheds nothing at exactly full capacity', () => {
    expect(plan(1_000).skipped).toEqual([]);
  });

  it('counts yesterday backlog against today capacity', () => {
    expect(plan(900, 400).pressure).toBe(1.3);
  });

  it('drops the secondary collection first', () => {
    expect(plan(1_200).skipped).toEqual(['categories', 'reviews']);
  });

  it('drops app refreshes only under sustained pressure', () => {
    expect(plan(2_000).skipped).toEqual(['categories', 'reviews', 'apps']);
  });

  it('never drops rank checks', () => {
    expect(plan(100_000).skipped).not.toContain('keywords');
  });

  it('sheds in the stated order', () => {
    const skipped = plan(2_000).skipped;
    const positions = skipped.map((stage) => DEGRADATION_ORDER.indexOf(stage));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(DEGRADATION_ORDER.at(-1)).toBe('keywords');
  });

  it('sheds nothing when capacity is unknown', () => {
    expect(plan(5_000, 0, 0)).toEqual({ pressure: 0, skipped: [] });
  });
});
