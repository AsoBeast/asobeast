import { CallToAction } from './call-to-action';
import { EmailLayout } from './email-layout';
import { EmailParagraph } from './email-text';
import { renderEmail } from './render-email';

const email = (
  <EmailLayout
    preview="A short preheader"
    origin="https://aso.example.com"
    footer={null}
  >
    <EmailParagraph>The paragraph copy.</EmailParagraph>
    <CallToAction href="https://aso.example.com/" label="Open" />
  </EmailLayout>
);

describe('renderEmail', () => {
  it('keeps an explicit text part untouched', async () => {
    const content = await renderEmail('Subject', email, 'Curated text');
    expect(content).toEqual(
      expect.objectContaining({ subject: 'Subject', text: 'Curated text' }),
    );
  });

  it('derives the text part from the html', async () => {
    const { text } = await renderEmail('Subject', email);
    expect(text).toContain('The paragraph copy.');
    expect(text.split('A short preheader').length - 1).toBeLessThanOrEqual(1);
  });

  it('keeps a short email far below the clipping threshold', async () => {
    const { html } = await renderEmail('Subject', email);
    expect(Buffer.byteLength(html)).toBeLessThan(15_000);
  });
});
