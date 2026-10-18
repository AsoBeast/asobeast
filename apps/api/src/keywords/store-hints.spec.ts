import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { StoreRequestError } from '../store-providers/errors';
import { storeDeadlinePassed } from '../store-providers/store-deadline';
import { suggestAround } from './store-hints';

jest.mock('../store-providers/store-deadline', () => ({
  storeDeadlinePassed: jest.fn(() => false),
}));

const deadlinePassed = storeDeadlinePassed as jest.MockedFunction<
  typeof storeDeadlinePassed
>;

const failure = () =>
  new StoreRequestError(Store.APP_STORE, 'suggest', 'timeout');

const providerFor = (answers: Record<string, unknown>) => ({
  suggest: jest.fn((seed: string) => {
    const answer = answers[seed];
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(answer as { term: string; priority?: number }[]);
  }),
});

describe('suggestAround', () => {
  beforeEach(() => {
    deadlinePassed.mockReset();
    deadlinePassed.mockReturnValue(false);
  });

  it('asks once per seed in order', async () => {
    const provider = providerFor({
      a: [{ term: 'a one' }, { term: 'a two', priority: 5 }],
      b: [{ term: 'b one' }],
      c: [],
    });

    const hints = await suggestAround(provider, ['a', 'b', 'c'], 'us');

    expect(provider.suggest.mock.calls).toEqual([
      ['a', 'us'],
      ['b', 'us'],
      ['c', 'us'],
    ]);
    expect(hints).toEqual([
      { seed: 'a', position: 1, term: 'a one', priority: undefined },
      { seed: 'a', position: 2, term: 'a two', priority: 5 },
      { seed: 'b', position: 1, term: 'b one', priority: undefined },
    ]);
  });

  it('keeps the answers of the seeds that answered', async () => {
    const provider = providerFor({
      a: [{ term: 'a one' }],
      b: failure(),
      c: [{ term: 'c one' }],
    });

    const hints = await suggestAround(provider, ['a', 'b', 'c'], 'us');

    expect(hints.map((hint) => hint.term)).toEqual(['a one', 'c one']);
  });

  it('rethrows the first failure when every seed failed', async () => {
    const first = failure();
    const provider = providerFor({ a: first, b: failure(), c: failure() });

    await expect(suggestAround(provider, ['a', 'b', 'c'], 'us')).rejects.toBe(
      first,
    );
  });

  it('rethrows any other error at once', async () => {
    const bad = new TypeError('bad');
    const provider = providerFor({ a: [], b: bad, c: [] });

    await expect(suggestAround(provider, ['a', 'b', 'c'], 'us')).rejects.toBe(
      bad,
    );
    expect(provider.suggest).not.toHaveBeenCalledWith('c', 'us');
  });

  it('stops asking once the store deadline has passed', async () => {
    deadlinePassed.mockReturnValueOnce(false).mockReturnValue(true);
    const provider = providerFor({ a: [{ term: 'a one' }], b: [], c: [] });

    const hints = await suggestAround(provider, ['a', 'b', 'c'], 'us');

    expect(provider.suggest.mock.calls).toEqual([['a', 'us']]);
    expect(hints.map((hint) => hint.term)).toEqual(['a one']);
  });

  it('answers nothing when the deadline passed before the first seed', async () => {
    deadlinePassed.mockReturnValue(true);
    const provider = providerFor({ a: [{ term: 'a one' }] });

    await expect(suggestAround(provider, ['a'], 'us')).resolves.toEqual([]);
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('answers nothing for no seeds', async () => {
    const provider = providerFor({});

    await expect(suggestAround(provider, [], 'us')).resolves.toEqual([]);
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('reports a partial answer', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const provider = providerFor({
      'secret one': [{ term: 'kept' }],
      'secret two': failure(),
    });

    await suggestAround(provider, ['secret one', 'secret two'], 'us');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('1 of 2 store suggestions failed');
    warn.mockRestore();
  });
});
