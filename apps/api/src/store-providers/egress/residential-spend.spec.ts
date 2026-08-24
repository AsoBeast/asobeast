import {
  maxRequests,
  ResidentialTariff,
  spendMonth,
  spendUsd,
} from './residential-spend';

const tariff = (over: Partial<ResidentialTariff> = {}): ResidentialTariff => ({
  mbPerRequest: 1.2,
  costPerGb: 3,
  monthlyCapUsd: 10,
  ...over,
});

describe('residential spend', () => {
  it('prices a request from the measured payload size', () => {
    expect(spendUsd(1024, tariff({ mbPerRequest: 1, costPerGb: 3 }))).toBe(3);
  });

  it('costs nothing before the first fallback', () => {
    expect(spendUsd(0, tariff())).toBe(0);
  });

  it('turns the cap into the last request the month may buy', () => {
    const priced = tariff({
      mbPerRequest: 1024,
      costPerGb: 1,
      monthlyCapUsd: 2,
    });

    expect(maxRequests(priced)).toBe(2);
  });

  it('rounds the ceiling down so the cap is never crossed', () => {
    const priced = tariff({
      mbPerRequest: 1024,
      costPerGb: 1,
      monthlyCapUsd: 2.5,
    });

    expect(maxRequests(priced)).toBe(2);
  });

  it('treats an unset cap as no residential budget at all', () => {
    expect(maxRequests(tariff({ monthlyCapUsd: 0 }))).toBe(0);
  });

  it('leaves a free gateway unbounded rather than refusing every request', () => {
    expect(maxRequests(tariff({ costPerGb: 0 }))).toBeGreaterThan(1_000_000);
  });

  it('buckets spend by utc month', () => {
    expect(spendMonth(new Date('2026-08-31T23:59:59Z'))).toBe('2026-08');
    expect(spendMonth(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09');
  });
});
