import type {
  AlertBatchAppSection,
  AlertBatchPayload,
  GranularAlertPayload,
} from '@asobeast/shared';
import {
  appDelisted,
  ratingDropped,
  reviewSpike,
} from '../listing-events.fixture';
import { batch, emptySection, negative } from '../email-fixtures.fixture';
import { chartEntered } from '../chart-events.fixture';
import { drop, improvement, milestone } from '../rank-events.fixture';
import { leadOf } from './report-lead';

const app = {
  id: 'a',
  name: 'Where Am I?',
  store: 'APP_STORE' as const,
  country: 'us',
};
const where = { id: 'a', name: 'Where Am I?' };
const keyword = (id: string, country = 'us') => ({
  id,
  text: `keyword ${id}`,
  store: 'APP_STORE' as const,
  country,
});
const left = (id: string, tier: 1 | 3 | 10 = 10, country = 'us') =>
  milestone({
    app: where,
    keyword: keyword(id, country),
    tier,
    direction: 'left',
    from: tier,
    to: tier + 2,
  });

const owned = (
  section: Partial<AlertBatchAppSection>,
  events: GranularAlertPayload[],
): AlertBatchPayload => ({
  ...batch,
  totals: { events: events.length, apps: 1 },
  apps: [{ ...emptySection(app), ...section }],
  events,
});

describe('leadOf', () => {
  it('folds the left milestones of a tier and counts the rest', () => {
    const milestones = [left('k1'), left('k2')];
    const dropped = drop({ app: where, keyword: keyword('k3') });

    expect(
      leadOf(
        owned({ rankMilestones: milestones, rankDrops: [dropped] }, [
          ...milestones,
          dropped,
        ]),
      ),
    ).toBe('Where Am I? lost 2 top 10 spots in US and 1 more change');
  });

  it('words a single top 3 exit and a lost first place', () => {
    expect(
      leadOf(owned({ rankMilestones: [left('k1', 3)] }, [left('k1', 3)])),
    ).toBe('Where Am I? lost 1 top 3 spot in US');
    const firsts = [left('k1', 1), left('k2', 1), left('k3', 1)];
    expect(leadOf(owned({ rankMilestones: firsts }, firsts))).toBe(
      'Where Am I? lost first place for 3 keywords in US',
    );
  });

  it('names the market of the first milestone and counts the other', () => {
    const milestones = [left('k1', 10, 'us'), left('k2', 10, 'de')];

    expect(leadOf(owned({ rankMilestones: milestones }, milestones))).toBe(
      'Where Am I? lost 1 top 10 spot in US and 1 more change',
    );
  });

  it('words a lone drop with its own sentence', () => {
    const dropped = drop({
      app: where,
      keyword: { ...keyword('k1'), text: 'habit tracker' },
      from: 4,
      to: 12,
    });

    expect(leadOf(owned({ rankDrops: [dropped] }, [dropped]))).toBe(
      'Where Am I? dropped from #4 to #12 for "habit tracker" in US',
    );
  });

  it('leads with the drop over a negative review', () => {
    const dropped = drop({ app: where, keyword: keyword('k1') });
    const review = { ...negative, app: where };

    expect(
      leadOf(
        owned({ rankDrops: [dropped], negativeReviews: [review] }, [
          review,
          dropped,
        ]),
      ),
    ).toMatch(/^Where Am I\? dropped .* and 1 more change$/);
  });

  it('cuts a long review lead at a hundred characters', () => {
    const review = {
      ...negative,
      app: where,
      review: { ...negative.review, score: 1, text: 'slow '.repeat(60) },
    };
    const lead = leadOf(owned({ negativeReviews: [review] }, [review]));

    expect(lead?.startsWith('A 1 star review of Where Am I?')).toBe(true);
    expect([...(lead ?? '')]).toHaveLength(100);
    expect(lead?.endsWith('…')).toBe(true);
  });

  it('words a climb and a chart entry when nothing outranks them', () => {
    const climb = improvement({ app: where, keyword: keyword('k1') });
    expect(leadOf(owned({ rankImprovements: [climb] }, [climb]))).toMatch(
      /^Where Am I\? climbed from/,
    );
    const entry = chartEntered({ app: where });
    expect(leadOf(owned({ chartMoves: [entry] }, [entry]))).toContain(
      'Where Am I?',
    );
  });

  it('leads with a delisting, then drops, then a rating drop and a spike', () => {
    const delisted = appDelisted({ app: { ...where, isCompetitor: false } });
    const dropped = drop({ app: where, keyword: keyword('k1') });
    const rating = ratingDropped({ app: where });
    const spike = reviewSpike({ app: where });

    expect(
      leadOf(
        owned(
          {
            availability: [delisted],
            rankDrops: [dropped],
            ratingDrops: [rating],
            reviewSpikes: [spike],
          },
          [spike, rating, dropped, delisted],
        ),
      ),
    ).toMatch(/^Where Am I\? is no longer listed/);
    expect(
      leadOf(
        owned({ ratingDrops: [rating], reviewSpikes: [spike] }, [
          spike,
          rating,
        ]),
      ),
    ).toMatch(/average rating fell/);
  });

  it('answers nothing for an empty batch or the competitor watch', () => {
    expect(leadOf(owned({}, []))).toBeNull();
    expect(leadOf({ ...owned({}, []), apps: [] })).toBeNull();
    expect(leadOf({ ...owned({}, []), scope: 'competitors' })).toBeNull();
  });
});
