import { render } from 'react-email';
import { CallToAction } from './call-to-action';
import { EmailLayout } from './email-layout';
import { renderEmail } from './render-email';

const URL = 'https://aso.example.com/verify?token=0123456789abcdef';

const email = (
  <EmailLayout preview="Preview" origin="https://aso.example.com" footer={null}>
    <CallToAction href={URL} label="Go" />
  </EmailLayout>
);

describe('CallToAction', () => {
  it('links the button and the fallback to the same address', async () => {
    const html = await render(email);
    const hrefs = [...html.matchAll(/<a[^>]*href="([^"]*)"/g)].map(
      ([, href]) => href,
    );
    expect(hrefs).toEqual([URL, URL]);
  });

  it('keeps the fallback paragraph out of the text part', async () => {
    const html = await render(email);
    expect(html).toMatch(/<p[^>]*data-skip-in-text="true"/);
  });

  it('prints the address exactly once in the text part', async () => {
    const { text } = await renderEmail('s', email);
    expect(text.split(URL).length - 1).toBe(1);
    expect(text).toContain('Go');
  });

  it('keeps orange on the button and writes the fallback link in ink', async () => {
    const html = await render(email);
    const [button, fallback] = [
      ...html.matchAll(/<a[^>]*style="([^"]*)"/g),
    ].map(([, style]) => style);
    expect(button).toContain('background-color:rgb(248,152,32)');
    expect(button).toContain('color:rgb(28,20,8)');
    expect(fallback).toContain('color:rgb(28,25,23)');
    expect(fallback).toContain('text-decoration-line:underline');
  });

  it('keeps the classic outlook spacing', async () => {
    expect(await render(email)).toContain('mso-padding-alt');
  });
});
