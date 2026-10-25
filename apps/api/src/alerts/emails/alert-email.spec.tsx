import { everyFieldChanged } from '../email-fixtures.fixture';
import { formatEmail } from '../email-format';
import { buildAlert } from '../report/build-alert';

describe('AlertEmail', () => {
  it('shows when the event occurred in minutes, in UTC', async () => {
    const { html, text } = await formatEmail({
      ...everyFieldChanged,
      occurredAt: '2026-07-11T08:05:59.123Z',
    });

    expect(html).toContain('11 Jul 2026, 08:05 UTC');
    expect(text).toContain('11 Jul 2026, 08:05 UTC');
    expect(text).not.toContain('2026-07-11T');
  });

  it('heads the email with the event sentence', async () => {
    const { html } = await formatEmail(everyFieldChanged);
    const { headline } = buildAlert(everyFieldChanged, null, false);

    expect(html).toMatch(
      new RegExp(`<h1[^>]*>${headline.replace(/'/g, '&#x27;')}</h1>`),
    );
  });

  it('keeps the largest instant alert far below the clipping threshold', async () => {
    const { html } = await formatEmail(everyFieldChanged, {
      origin: 'https://aso.example.com',
      unsubscribe: null,
    });
    expect(Buffer.byteLength(html)).toBeLessThan(25_000);
  });
});
