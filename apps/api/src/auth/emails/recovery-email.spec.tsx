import { recoveryEmail } from './recovery-email';

const LINK = 'https://aso.example.com/reset-password?token=0123456789abcdef';

const render = (address = 'ada@example.com') =>
  recoveryEmail({ origin: 'https://aso.example.com', address, link: LINK });

describe('recoveryEmail', () => {
  it('keeps the subject recipients filter on', async () => {
    expect((await render()).subject).toBe('Reset your asobeast password');
  });

  it('renders the heading, the button and the instance', async () => {
    const { html } = await render();
    expect(html).toContain('Reset your password');
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('Sent by AsoBeast at aso.example.com');
  });

  it('prints the link once and the notice in the text part', async () => {
    const { text } = await render();
    expect(text.split(LINK).length - 1).toBe(1);
    expect(text).toContain(
      'If you did not ask for it, ignore this email and your password stays the same.',
    );
  });

  it('escapes the address', async () => {
    const { html } = await render('a&b<c>@example.com');
    expect(html).toContain('a&amp;b&lt;c&gt;@example.com');
  });

  it('stays far below the clipping threshold', async () => {
    expect(Buffer.byteLength((await render()).html)).toBeLessThan(15_000);
  });
});
