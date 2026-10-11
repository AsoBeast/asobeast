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

  it('flags a subdomain of a throwaway domain', () => {
    expect(isDisposableEmail('someone@inbox.mailinator.com')).toBe(true);
  });

  it('flags the throwaway domains the list carried before it was a package', () => {
    for (const domain of [
      '10minutemail.com',
      'dispostable.com',
      'fakeinbox.com',
      'getnada.com',
      'guerrillamail.com',
      'maildrop.cc',
      'sharklasers.com',
      'temp-mail.org',
      'throwawaymail.com',
      'trashmail.com',
    ]) {
      expect(isDisposableEmail(`someone@${domain}`)).toBe(true);
    }
  });

  it('leaves the providers people really use alone', () => {
    for (const domain of [
      'gmail.com',
      'googlemail.com',
      'outlook.com',
      'hotmail.com',
      'live.com',
      'yahoo.com',
      'icloud.com',
      'me.com',
      'proton.me',
      'protonmail.com',
      'fastmail.com',
      'hey.com',
      'gmx.com',
      'aol.com',
      'zoho.com',
    ]) {
      expect(isDisposableEmail(`someone@${domain}`)).toBe(false);
    }
  });
});
