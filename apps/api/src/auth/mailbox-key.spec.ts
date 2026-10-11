import { mailboxOf } from './mailbox-key';

describe('mailboxOf', () => {
  it.each([
    ['person@example.com', 'person@example.com'],
    ['Person@Example.COM', 'person@example.com'],
    ['  person@example.com  ', 'person@example.com'],
    ['person@example.com.', 'person@example.com'],
  ])('reads %s as %s', (given, expected) => {
    expect(mailboxOf(given)).toBe(expected);
  });

  it.each([
    ['person+trial1@example.com', 'person@example.com'],
    ['person+a+b@example.com', 'person@example.com'],
    ['person+@example.com', 'person@example.com'],
    ['person+tag@outlook.com', 'person@outlook.com'],
    ['person+tag@icloud.com', 'person@icloud.com'],
  ])('drops the plus tag of %s on any domain', (given, expected) => {
    expect(mailboxOf(given)).toBe(expected);
  });

  it('keeps a local part that starts with a plus', () => {
    expect(mailboxOf('+tag@example.com')).toBe('+tag@example.com');
  });

  it.each([
    ['first.last@gmail.com', 'firstlast@gmail.com'],
    ['f.i.r.s.t.l.a.s.t@gmail.com', 'firstlast@gmail.com'],
    ['first.last+promo@gmail.com', 'firstlast@gmail.com'],
    ['firstlast+a.b@gmail.com', 'firstlast@gmail.com'],
  ])('ignores dots and tags on gmail in %s', (given, expected) => {
    expect(mailboxOf(given)).toBe(expected);
  });

  it('treats googlemail.com as gmail.com', () => {
    expect(mailboxOf('First.Last@googlemail.com')).toBe('firstlast@gmail.com');
  });

  it.each(['first.last@outlook.com', 'first.last@example.com'])(
    'keeps the dots of a domain that counts them: %s',
    (address) => {
      expect(mailboxOf(address)).toBe(address);
    },
  );

  it('keeps subdomains and similar domains apart from gmail', () => {
    expect(mailboxOf('a.b@mail.gmail.com')).toBe('a.b@mail.gmail.com');
    expect(mailboxOf('a.b@gmail.com.example.org')).toBe(
      'a.b@gmail.com.example.org',
    );
  });

  it('folds compatibility forms of the same characters', () => {
    expect(mailboxOf('ｐerson@example.com')).toBe('person@example.com');
  });

  it('returns something other than an address as typed, lowercased', () => {
    expect(mailboxOf('Not-An-Email')).toBe('not-an-email');
    expect(mailboxOf('')).toBe('');
    expect(mailboxOf('@example.com')).toBe('@example.com');
  });

  it.each([
    ['"person"@example.com', 'person@example.com'],
    ['"person+tag"@example.com', 'person@example.com'],
    ['"first.last"@gmail.com', 'firstlast@gmail.com'],
  ])('reads the quoted local part of %s as %s', (given, expected) => {
    expect(mailboxOf(given)).toBe(expected);
  });

  it.each([
    ['person@bücher.de', 'person@xn--bcher-kva.de'],
    ['person@BÜCHER.de', 'person@xn--bcher-kva.de'],
    ['person@xn--bcher-kva.de', 'person@xn--bcher-kva.de'],
    ['person@bücher.de.', 'person@xn--bcher-kva.de'],
  ])('reads the unicode domain of %s in its ascii form', (given, expected) => {
    expect(mailboxOf(given)).toBe(expected);
  });

  it('splits at the last at sign', () => {
    expect(mailboxOf('"a@b"+x@example.com')).toBe('"a@b"@example.com');
  });
});
