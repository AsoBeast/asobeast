import { isDisposableEmail } from './disposable-email';

describe('isDisposableEmail', () => {
  it('flags a known throwaway domain', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true);
  });

  it('ignores case and padding around the domain', () => {
    expect(isDisposableEmail('Someone@YOPMAIL.com ')).toBe(true);
  });

  it('leaves an ordinary domain alone', () => {
    expect(isDisposableEmail('owner@example.com')).toBe(false);
  });

  it('treats a malformed address as ordinary rather than throwing', () => {
    expect(isDisposableEmail('not-an-email')).toBe(false);
    expect(isDisposableEmail('')).toBe(false);
  });
});
