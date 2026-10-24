import {
  actionOpened,
  digest,
  dropped,
  everyFieldChanged,
} from '../email-fixtures.fixture';
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

  it('opens an instant alert with the app icon, name and storefront', async () => {
    const icon = 'https://is1-ssl.mzstatic.com/image/thumb/app/512x512bb.jpg';
    const { html } = await formatEmail(
      {
        ...dropped,
        app: {
          ...dropped.app,
          iconUrl: icon,
          store: 'APP_STORE',
          country: 'us',
        },
      },
      { origin: 'https://aso.example.com', unsubscribe: null },
    );

    expect(html).toContain(`src="${icon}"`);
    expect(html).toContain('>My App</a>');
    expect(html).toContain('App Store · US');
  });

  it('draws no header for an event without an app', async () => {
    const { html } = await formatEmail(digest);

    expect(html).not.toContain('<img alt=""');
  });

  it.each([
    ['an app event', dropped, 'Open app'],
    ['an action', actionOpened, 'Open the action'],
    ['the weekly digest', digest, 'Open AsoBeast'],
  ] as const)('labels the button of %s', async (_kind, payload, label) => {
    const { html } = await formatEmail(payload, {
      origin: 'https://aso.example.com',
      unsubscribe: null,
    });

    expect(html).toContain(label);
  });
});
