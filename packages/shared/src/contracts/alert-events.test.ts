import { describe, expect, it } from 'vitest';
import { QUERY_BOUNDS } from '../query-bounds';
import {
  ALERT_FEED_DAYS,
  ALERT_FEED_EVENTS,
  isAlertFeedEvent,
} from './alert-events';
import { WEBHOOK_EVENTS } from './changes';

describe('alert event feed contract', () => {
  it('lists every webhook event but the weekly digest and new reviews, in order', () => {
    const expected = WEBHOOK_EVENTS.filter(
      (event) => event !== 'digest.weekly' && event !== 'review.new',
    );

    expect(ALERT_FEED_EVENTS).toEqual(expected);
  });

  it.each([
    ['rank.dropped', true],
    ['app.unlisted_market', true],
    ['review.new', false],
    ['digest.weekly', false],
    ['nope', false],
  ])('answers whether %s is a feed event', (value, expected) => {
    expect(isAlertFeedEvent(value)).toBe(expected);
  });

  it('looks back thirty days', () => {
    expect(ALERT_FEED_DAYS).toBe(30);
  });

  it('pages the feed by at most a hundred events', () => {
    expect(QUERY_BOUNDS.alertEventsLimit).toEqual({
      min: 1,
      max: 100,
      default: 50,
    });
  });
});
