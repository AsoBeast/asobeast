import { everyFieldChanged } from '../email-fixtures.fixture';
import { formatEmail } from '../email-format';
import { summarize } from '../alert-summary';
import { occurredAtLabel } from './alert-email';

describe('AlertEmail', () => {
  it('shows when the event occurred in minutes, in UTC', () => {
    expect(occurredAtLabel('2026-07-11T08:05:59.123Z')).toBe(
      '2026-07-11 08:05 UTC',
    );
  });

  it('heads the email with the event summary', async () => {
    const { html } = await formatEmail(everyFieldChanged);
    expect(html).toMatch(
      new RegExp(`<h1[^>]*>${summarize(everyFieldChanged)}</h1>`),
    );
  });

  it('keeps the largest instant alert far below the clipping threshold', async () => {
    const { html } = await formatEmail(everyFieldChanged, {
      origin: 'https://aso.example.com',
    });
    expect(Buffer.byteLength(html)).toBeLessThan(25_000);
  });
});
