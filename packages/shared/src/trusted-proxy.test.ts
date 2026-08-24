import { describe, expect, it } from 'vitest';
import { TRUSTED_PROXY_HOPS_MAX, trustedProxyHops } from './trusted-proxy';

describe('trustedProxyHops', () => {
  it('treats an absent or blank value as no trusted proxy', () => {
    expect(trustedProxyHops(undefined)).toBe(0);
    expect(trustedProxyHops('')).toBe(0);
    expect(trustedProxyHops('   ')).toBe(0);
  });

  it('keeps the boolean spelling working as a single hop', () => {
    expect(trustedProxyHops('true')).toBe(1);
    expect(trustedProxyHops('TRUE')).toBe(1);
    expect(trustedProxyHops(' true ')).toBe(1);
    expect(trustedProxyHops('false')).toBe(0);
  });

  it('accepts a hop count for a longer chain', () => {
    expect(trustedProxyHops('0')).toBe(0);
    expect(trustedProxyHops('1')).toBe(1);
    expect(trustedProxyHops('3')).toBe(3);
    expect(trustedProxyHops(String(TRUSTED_PROXY_HOPS_MAX))).toBe(
      TRUSTED_PROXY_HOPS_MAX,
    );
  });

  it('never reads a hop count off the object prototype', () => {
    for (const name of [
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
    ]) {
      expect(trustedProxyHops(name)).toBeNaN();
    }
  });

  it('rejects a value that is neither a boolean nor a bounded hop count', () => {
    expect(trustedProxyHops('yes')).toBeNaN();
    expect(trustedProxyHops('-1')).toBeNaN();
    expect(trustedProxyHops('1.5')).toBeNaN();
    expect(trustedProxyHops(String(TRUSTED_PROXY_HOPS_MAX + 1))).toBeNaN();
  });
});
