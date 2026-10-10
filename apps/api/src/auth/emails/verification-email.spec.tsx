import { verificationEmail } from './verification-email';

const LINK = 'https://aso.example.com/verify?token=0123456789abcdef';

const render = (startsTrial = true) =>
  verificationEmail({
    origin: 'https://aso.example.com',
    address: 'ada@example.com',
    link: LINK,
    startsTrial,
    hours: 24,
  });

describe('verificationEmail', () => {
  it('keeps the subject recipients filter on', async () => {
    expect((await render()).subject).toBe('Confirm your asobeast email');
  });

  it('renders the heading, the button and the instance', async () => {
    const { html } = await render();
    expect(html).toContain('Confirm your email');
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('Sent by AsoBeast at aso.example.com');
  });

  it('prints the link once and the expiry in the text part', async () => {
    const { text } = await render();
    expect(text.split(LINK).length - 1).toBe(1);
    expect(text).toContain('The link works for 24 hours.');
  });

  it('starts the trial only when the account has one', async () => {
    expect((await render(true)).text).toContain('to start your trial');
    const { html, text } = await render(false);
    expect(text).toContain('to finish setting up your account');
    expect(html).not.toMatch(/trial/i);
  });

  it('escapes the address', async () => {
    const { html } = await verificationEmail({
      origin: null,
      address: 'a&b<c>@example.com',
      link: LINK,
      startsTrial: true,
      hours: 24,
    });
    expect(html).toContain('a&amp;b&lt;c&gt;@example.com');
  });

  it('stays far below the clipping threshold', async () => {
    expect(Buffer.byteLength((await render()).html)).toBeLessThan(15_000);
  });
});
