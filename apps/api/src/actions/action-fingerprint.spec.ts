import { ACTION_RULES, ActionRule } from '@asobeast/shared';
import {
  actionFingerprint,
  FINGERPRINT_LENGTH,
  FingerprintInput,
  normalizeDiscriminator,
} from './action-fingerprint';

const base: FingerprintInput = {
  rule: 'keyword.add_uncovered',
  appId: 'app_1',
  store: 'APP_STORE',
  country: 'us',
  keywordId: 'kw_1',
  discriminator: null,
};

describe('actionFingerprint', () => {
  it('produces a 32 character lowercase hex digest', () => {
    const fingerprint = actionFingerprint(base);

    expect(fingerprint).toHaveLength(FINGERPRINT_LENGTH);
    expect(fingerprint).toMatch(/^[0-9a-f]+$/);
  });

  it('is stable for identical input', () => {
    expect(actionFingerprint(base)).toBe(actionFingerprint({ ...base }));
  });

  it('ignores every volatile magnitude because none is an input', () => {
    const subject = { ...base, discriminator: null };

    expect(actionFingerprint(subject)).toBe(actionFingerprint({ ...subject }));
    expect(Object.keys(base)).toEqual([
      'rule',
      'appId',
      'store',
      'country',
      'keywordId',
      'discriminator',
    ]);
  });

  it('changes when the discriminator changes', () => {
    expect(
      actionFingerprint({ ...base, discriminator: '2026-07-01' }),
    ).not.toBe(actionFingerprint({ ...base, discriminator: '2026-07-02' }));
  });

  it('gives every rule on the same subject a distinct fingerprint', () => {
    const fingerprints = ACTION_RULES.map((rule: ActionRule) =>
      actionFingerprint({ ...base, rule }),
    );

    expect(new Set(fingerprints).size).toBe(ACTION_RULES.length);
  });

  it('separates app, store, country and keyword', () => {
    const variants: FingerprintInput[] = [
      base,
      { ...base, appId: 'app_2' },
      { ...base, store: 'GOOGLE_PLAY' },
      { ...base, country: 'de' },
      { ...base, keywordId: 'kw_2' },
      { ...base, keywordId: null },
    ];

    expect(new Set(variants.map(actionFingerprint)).size).toBe(variants.length);
  });

  it('normalizes casing, padding and internal whitespace in the discriminator', () => {
    const canonical = actionFingerprint({
      ...base,
      discriminator: 'crashes on launch',
    });

    expect(
      actionFingerprint({ ...base, discriminator: '  CRASHES   on Launch  ' }),
    ).toBe(canonical);
  });

  it('neutralizes a hostile discriminator containing the separator', () => {
    const hostile = actionFingerprint({
      ...base,
      keywordId: 'kw_1',
      discriminator: 'a~b',
    });
    const collision = actionFingerprint({
      ...base,
      keywordId: 'kw_1~a',
      discriminator: 'b',
    });

    expect(hostile).not.toBe(collision);
    expect(normalizeDiscriminator('a~b')).toBe('a b');
  });

  it('renders a null keyword and a null discriminator identically to their empty forms', () => {
    expect(actionFingerprint({ ...base, keywordId: null })).toBe(
      actionFingerprint({ ...base, keywordId: '' }),
    );
    expect(actionFingerprint({ ...base, discriminator: null })).toBe(
      actionFingerprint({ ...base, discriminator: '' }),
    );
  });

  it('cannot collide across workspaces tracking the same store app', () => {
    const inWorkspaceA = actionFingerprint({ ...base, appId: 'app_ws_a' });
    const inWorkspaceB = actionFingerprint({ ...base, appId: 'app_ws_b' });

    expect(inWorkspaceA).not.toBe(inWorkspaceB);
  });
});
