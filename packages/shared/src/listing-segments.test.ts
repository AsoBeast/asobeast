import { describe, expect, it } from 'vitest';
import { listingSegments } from './listing-segments';

describe('listingSegments', () => {
  it('splits on sentence and list punctuation', () => {
    expect(
      listingSegments('Dark mode. Sync: fast, simple | free & open'),
    ).toEqual(['Dark mode', ' Sync', ' fast', ' simple ', ' free ', ' open']);
  });

  it('drops negated auxiliaries and contraction suffixes', () => {
    expect(
      listingSegments("It doesn't sync and the app's timer won't stop"),
    ).toEqual(['It   sync and the app timer   stop']);
  });

  it('separates words around a version number', () => {
    expect(listingSegments('Since 0.78.8 sync fails')).toEqual([
      'Since ',
      ' sync fails',
    ]);
  });

  it('keeps a plain sentence whole', () => {
    expect(listingSegments('Habit tracker for focus')).toEqual([
      'Habit tracker for focus',
    ]);
  });
});
