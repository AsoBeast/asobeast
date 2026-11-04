import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { KeywordScope, SERP_CAPTURE_DEPTH } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import { EMPTY_ANSWER_RETRIES } from '../store-providers/result-plausibility';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import {
  positionsByStoreAppId,
  SerpCapture,
  serpEntryRows,
} from './serp-capture';

const FROZEN_NOW = new Date('2026-07-18T09:30:00.000Z');
const TODAY = new Date('2026-07-18T00:00:00.000Z');
const THREE_DAYS_AGO = new Date('2026-07-15T00:00:00.000Z');

const keyword = (store: Store = Store.APP_STORE): KeywordScope => ({
  id: 'kw1',
  text: 'habit tracker',
  store,
  country: 'us',
});

const items = (count: number): SearchItem[] =>
  Array.from({ length: count }, (_, index) => ({
    storeAppId: `app-${index + 1}`,
    title: `App ${index + 1}`,
  }));

const setup = (lastRanked: Date | null = null) => {
  const search = jest.fn<Promise<SearchItem[]>, [string, string, number]>();
  const findFirst = jest
    .fn()
    .mockResolvedValue(lastRanked ? { date: lastRanked } : null);
  const calls: string[] = [];
  const deleteMany = jest.fn((args: unknown) => {
    calls.push('delete');
    return Promise.resolve(args);
  });
  const createMany = jest.fn((args: unknown) => {
    calls.push('create');
    return Promise.resolve(args);
  });
  const withTransaction = jest.fn(
    (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ serpEntry: { deleteMany, createMany } }),
  );
  const prisma = { serpEntry: { findFirst }, withTransaction };
  const registry = { get: () => ({ search }) };
  const capture = new SerpCapture(
    prisma as unknown as PrismaService,
    registry as unknown as StoreProviderRegistry,
  );
  return {
    capture,
    search,
    findFirst,
    deleteMany,
    createMany,
    withTransaction,
    calls,
  };
};

const settled = async (work: Promise<unknown>): Promise<unknown> => {
  const outcome = work.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await jest.runAllTimersAsync();
  return outcome;
};

describe('positionsByStoreAppId', () => {
  it('keeps the first, best position of a repeated store id', () => {
    const positions = positionsByStoreAppId([
      { storeAppId: 'a', title: 'A' },
      { storeAppId: 'b', title: 'B' },
      { storeAppId: 'a', title: 'A again' },
    ]);

    expect([...positions]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('answers an empty map for no results', () => {
    expect(positionsByStoreAppId([]).size).toBe(0);
  });
});

describe('serpEntryRows', () => {
  it('keeps the top of the capture depth with absent details as null', () => {
    const rows = serpEntryRows('kw1', TODAY, [
      {
        storeAppId: 'first',
        title: 'First',
        developer: 'Dev',
        iconUrl: 'https://icon',
        ratingAvg: 4.5,
        ratingCount: 120,
      },
      ...items(119),
    ]);

    expect(rows).toHaveLength(SERP_CAPTURE_DEPTH);
    expect(rows.map((row) => row.position)).toEqual(
      Array.from({ length: SERP_CAPTURE_DEPTH }, (_, index) => index + 1),
    );
    expect(rows[0]).toEqual({
      keywordId: 'kw1',
      date: TODAY,
      position: 1,
      storeAppId: 'first',
      title: 'First',
      developer: 'Dev',
      iconUrl: 'https://icon',
      ratingAvg: 4.5,
      ratingCount: 120,
    });
    expect(rows[1]).toEqual({
      keywordId: 'kw1',
      date: TODAY,
      position: 2,
      storeAppId: 'app-1',
      title: 'App 1',
      developer: null,
      iconUrl: null,
      ratingAvg: null,
      ratingCount: null,
    });
  });
});

describe('SerpCapture', () => {
  beforeEach(() => {
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(FROZEN_NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('search', () => {
    it('returns the results unchanged without reading earlier captures', async () => {
      const { capture, search, findFirst } = setup();
      const results = items(3);
      search.mockResolvedValue(results);

      expect(await capture.search(keyword(), false)).toBe(results);
      expect(search).toHaveBeenCalledWith('habit tracker', 'us', 200);
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('accepts an empty answer for a phrase never captured before', async () => {
      const { capture, search } = setup();
      search.mockResolvedValue([]);

      expect(await capture.search(keyword(), false)).toEqual([]);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('asks again and leaves an answer that stays empty to the queue', async () => {
      const { capture, search } = setup(THREE_DAYS_AGO);
      search.mockResolvedValue([]);

      expect(await settled(capture.search(keyword(), false))).toEqual({
        error: expect.objectContaining({
          constructor: ImplausibleResultError,
          retryable: true,
        }) as unknown,
      });
      expect(search).toHaveBeenCalledTimes(1 + EMPTY_ANSWER_RETRIES.APP_STORE);
    });

    it('answers the first non empty answer of a retry', async () => {
      const { capture, search } = setup(THREE_DAYS_AGO);
      const results = items(2);
      search.mockResolvedValueOnce([]).mockResolvedValueOnce(results);

      expect(await settled(capture.search(keyword(), false))).toEqual({
        value: results,
      });
    });

    it('settles an answer still empty on the last attempt as null', async () => {
      const { capture, search } = setup(THREE_DAYS_AGO);
      search.mockResolvedValue([]);

      expect(await settled(capture.search(keyword(), true))).toEqual({
        value: null,
      });
    });

    it('refuses an empty google play answer even on the last attempt', async () => {
      const { capture, search } = setup(THREE_DAYS_AGO);
      search.mockResolvedValue([]);

      expect(
        await settled(capture.search(keyword(Store.GOOGLE_PLAY), true)),
      ).toEqual({
        error: expect.objectContaining({
          constructor: ImplausibleResultError,
          retryable: false,
        }) as unknown,
      });
      expect(search).toHaveBeenCalledTimes(1);
    });
  });

  describe('store', () => {
    it('replaces the day in one transaction and returns the rows', async () => {
      const { capture, deleteMany, createMany, withTransaction, calls } =
        setup();

      const rows = await capture.store('kw1', TODAY, items(60));

      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(['delete', 'create']);
      expect(deleteMany).toHaveBeenCalledWith({
        where: { keywordId: 'kw1', date: TODAY },
      });
      expect(createMany).toHaveBeenCalledWith({ data: rows });
      expect(rows).toEqual(serpEntryRows('kw1', TODAY, items(60)));
    });

    it('clears the day for a search that answered nothing', async () => {
      const { capture, deleteMany, createMany, calls } = setup();

      await expect(capture.store('kw1', TODAY, [])).resolves.toEqual([]);

      expect(calls).toEqual(['delete', 'create']);
      expect(deleteMany).toHaveBeenCalledWith({
        where: { keywordId: 'kw1', date: TODAY },
      });
      expect(createMany).toHaveBeenCalledWith({ data: [] });
    });
  });
});
