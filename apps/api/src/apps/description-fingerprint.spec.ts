import { descriptionFingerprint } from './description-fingerprint';

describe('descriptionFingerprint', () => {
  const text = 'Plan your family week.\nShare chores and the calendar.';

  it.each([
    ['windows line endings', text.replaceAll('\n', '\r\n')],
    ['runs of spaces', text.replace(' your', '   your')],
    ['tabs', text.replace(' the', '\tthe')],
    ['a trailing newline', `${text}\n`],
    ['leading spaces', `  ${text}`],
  ])('is equal for texts that differ only in %s', (_case, variant) => {
    expect(descriptionFingerprint(variant)).toBe(descriptionFingerprint(text));
  });

  it('is equal for composed and decomposed accents', () => {
    expect(descriptionFingerprint('Café crème')).toBe(
      descriptionFingerprint('Café crème'),
    );
  });

  it('differs for a changed word', () => {
    expect(descriptionFingerprint(text)).not.toBe(
      descriptionFingerprint(text.replace('chores', 'tasks')),
    );
  });

  it('is a 64 character hex digest', () => {
    expect(descriptionFingerprint(text)).toMatch(/^[0-9a-f]{64}$/);
  });
});
