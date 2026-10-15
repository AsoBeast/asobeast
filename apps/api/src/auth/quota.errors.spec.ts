import { QuotaExceededError } from './quota.errors';

describe('QuotaExceededError', () => {
  it.each([
    ['apps', 'Apps'],
    ['keywordMarkets', 'Keyword markets'],
    ['competitors', 'Competitors'],
    ['chartFollows', 'Followed chart categories'],
  ] as const)('names the %s quota in words', (resource, label) => {
    const error = new QuotaExceededError({
      resource,
      plan: 'trial',
      limit: 10,
      used: 10,
      requested: 1,
      upgradeTo: 'indie',
    });

    expect(error.message).toBe(
      `${label} limit reached: 10 of 10 used on the trial plan, 1 more requested`,
    );
  });
});
