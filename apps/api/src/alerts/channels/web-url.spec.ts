import { isWebUrl } from './web-url';

describe('isWebUrl', () => {
  it('accepts an http or https address and nothing else', () => {
    expect(isWebUrl('https://x.test/a.png')).toBe(true);
    expect(isWebUrl('http://x.test/a.png')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('data:image/png;base64,AA')).toBe(false);
    expect(isWebUrl(null)).toBe(false);
  });
});
