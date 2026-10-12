import { canonicalAddress, canonicalText } from './canonical-address';

describe('canonicalText', () => {
  it('folds compatibility forms, padding and case', () => {
    expect(canonicalText('  ＰErson@Example.COM ')).toBe('person@example.com');
  });
});

describe('canonicalAddress', () => {
  it('splits an address at its last at sign', () => {
    expect(canonicalAddress('Person@Example.com')).toEqual({
      local: 'person',
      domain: 'example.com',
    });
  });

  it('answers nothing for text that has no local part and domain', () => {
    expect(canonicalAddress('not-an-email')).toBeNull();
    expect(canonicalAddress('@example.com')).toBeNull();
    expect(canonicalAddress('')).toBeNull();
  });

  it('drops the trailing dot of a fully qualified domain', () => {
    expect(canonicalAddress('person@example.com.')?.domain).toBe('example.com');
  });

  it('reads a unicode domain in its ascii form', () => {
    expect(canonicalAddress('person@Bücher.de')?.domain).toBe(
      'xn--bcher-kva.de',
    );
    expect(canonicalAddress('person@xn--bcher-kva.de')?.domain).toBe(
      'xn--bcher-kva.de',
    );
  });

  it('keeps a domain that has no ascii form as written', () => {
    expect(canonicalAddress('person@exa mple.com')?.domain).toBe(
      'exa mple.com',
    );
  });

  it('removes the quotes around a quoted local part', () => {
    expect(canonicalAddress('"First.Last"@example.com')?.local).toBe(
      'first.last',
    );
  });

  it('keeps quotes that do not enclose the whole local part', () => {
    expect(canonicalAddress('"a@b"+x@example.com')?.local).toBe('"a@b"+x');
    expect(canonicalAddress('"@example.com')?.local).toBe('"');
  });
});
