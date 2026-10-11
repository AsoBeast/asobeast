import {
  ALERT_CONFIRMATION_SUBJECT,
  alertConfirmationEmail,
} from './alert-confirmation-email';

const LINK = 'https://aso.example.com/confirm-alert?alert=ea_1&token=abc';

const LINK_IN_HTML = LINK.replace('&', '&amp;');

const render = (requestedBy = 'owner@example.com') =>
  alertConfirmationEmail({
    origin: 'https://aso.example.com',
    address: 'alerts@example.net',
    requestedBy,
    link: LINK,
    days: 7,
  });

describe('alertConfirmationEmail', () => {
  it('keeps the subject recipients filter on', async () => {
    expect((await render()).subject).toBe(ALERT_CONFIRMATION_SUBJECT);
  });

  it('names who asked, the address, the button and the instance', async () => {
    const { html } = await render();
    expect(html).toContain('Confirm alert emails');
    expect(html).toContain('owner@example.com asked to send AsoBeast alerts');
    expect(html).toContain('alerts@example.net');
    expect(html).toContain(`href="${LINK_IN_HTML}"`);
    expect(html).toContain('Sent by AsoBeast at aso.example.com');
  });

  it('prints the link once and says nothing is sent without it in the text part', async () => {
    const { text } = await render();
    expect(text.split(LINK).length - 1).toBe(1);
    expect(text).toContain('nothing is sent to this address');
  });

  it('escapes the requester', async () => {
    const { html } = await render('a&b<c>@example.com');
    expect(html).toContain('a&amp;b&lt;c&gt;@example.com');
  });

  it('stays far below the clipping threshold', async () => {
    expect(Buffer.byteLength((await render()).html)).toBeLessThan(15_000);
  });
});
