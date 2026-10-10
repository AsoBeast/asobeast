import { invitationEmail } from './invitation-email';

const LINK = 'https://aso.example.com/invite?token=0123456789abcdef';

const render = (inviter = 'owner@example.com') =>
  invitationEmail({
    origin: 'https://aso.example.com',
    inviter,
    link: LINK,
    days: 7,
  });

describe('invitationEmail', () => {
  it('keeps the subject recipients filter on', async () => {
    expect((await render()).subject).toBe(
      'owner@example.com invited you to asobeast',
    );
  });

  it('renders the heading, the button and the instance', async () => {
    const { html } = await render();
    expect(html).toContain('Join your team on AsoBeast');
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('Sent by AsoBeast at aso.example.com');
  });

  it('prints the link once and the expiry in the text part', async () => {
    const { text } = await render();
    expect(text.split(LINK).length - 1).toBe(1);
    expect(text).toContain('The invitation expires in 7 days.');
  });

  it('escapes the inviter', async () => {
    const { html } = await render('a&b<c>@example.com');
    expect(html).toContain('a&amp;b&lt;c&gt;@example.com');
  });

  it('stays far below the clipping threshold', async () => {
    expect(Buffer.byteLength((await render()).html)).toBeLessThan(15_000);
  });
});
