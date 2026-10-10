import { render } from 'react-email';
import { EmailLayout } from './email-layout';
import { EmailParagraph } from './email-text';

const layout = (origin: string | null, body = 'Hello') =>
  render(
    <EmailLayout preview="Preview line" origin={origin} footer={null}>
      <EmailParagraph>{body}</EmailParagraph>
    </EmailLayout>,
  );

describe('EmailLayout', () => {
  it('renders an english html document', async () => {
    const html = await layout('https://aso.example.com');
    expect(html.startsWith('<!DOCTYPE html')).toBe(true);
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toMatch(/<html[^>]*dir="ltr"/);
  });

  it('opts in to light and dark rendering', async () => {
    const html = await layout('https://aso.example.com');
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('prefers-color-scheme:dark');
  });

  it('paints the dark canvas on the full width table, not only the body', async () => {
    const html = await layout('https://aso.example.com');
    expect(html).toMatch(/<table[^>]*class="dark_bg-night-canvas"/);
  });

  it('carries the preview text in the hidden preheader', async () => {
    const html = await layout('https://aso.example.com');
    expect(html).toMatch(/<div[^>]*display:none[^>]*>Preview line/);
  });

  it('shows the logo and the instance with a web origin', async () => {
    const html = await layout('https://aso.example.com');
    expect(html).toMatch(
      /<img[^>]*src="https:\/\/aso\.example\.com\/brand\/email-mark\.png"/,
    );
    expect(html).toMatch(/<img[^>]*width="48"/);
    expect(html).toMatch(/<img[^>]*alt=""/);
    expect(html).toContain('Sent by AsoBeast at aso.example.com');
  });

  it('keeps the wordmark and drops every link without a web origin', async () => {
    const html = await layout(null);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('Sent by');
    expect(html).toContain('AsoBeast');
  });

  it('escapes text it is given', async () => {
    const html = await layout(null, '<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script');
  });

  it('limits the container to 600 pixels', async () => {
    expect(await layout(null)).toContain('max-width:600px');
  });
});
