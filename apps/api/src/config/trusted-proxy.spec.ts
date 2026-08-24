import type { NestExpressApplication } from '@nestjs/platform-express';
import { TRUSTED_PROXY_HOPS_MAX } from '@asobeast/shared';
import { EnvSchema } from './env';
import { applyTrustedProxy } from './trusted-proxy';

function recorder(): {
  app: NestExpressApplication;
  calls: [string, unknown][];
} {
  const calls: [string, unknown][] = [];
  const app = {
    set: (key: string, value: unknown) => {
      calls.push([key, value]);
    },
  } as unknown as NestExpressApplication;
  return { app, calls };
}

function hopsFor(value: string | undefined): number {
  return EnvSchema.parse({
    AUTH_SECRET: 'a'.repeat(32),
    ...(value === undefined ? {} : { TRUST_PROXY: value }),
  }).TRUST_PROXY;
}

describe('applyTrustedProxy', () => {
  it('leaves express at its default when no hop is trusted', () => {
    const { app, calls } = recorder();

    applyTrustedProxy(app, 0);

    expect(calls).toEqual([]);
  });

  it('trusts exactly the hops it was given', () => {
    const { app, calls } = recorder();

    applyTrustedProxy(app, 2);

    expect(calls).toEqual([['trust proxy', 2]]);
  });

  it('never hands express the unbounded boolean the chain was trusted with', () => {
    const { app, calls } = recorder();

    applyTrustedProxy(app, hopsFor('true'));

    expect(calls).toEqual([['trust proxy', 1]]);
  });
});

describe('TRUST_PROXY', () => {
  it('reads an absent value as no trusted hop', () => {
    expect(hopsFor(undefined)).toBe(0);
  });

  it('keeps the boolean spelling working as a single hop', () => {
    expect(hopsFor('true')).toBe(1);
    expect(hopsFor('false')).toBe(0);
  });

  it('accepts a hop count for a longer chain', () => {
    expect(hopsFor('3')).toBe(3);
    expect(hopsFor(String(TRUSTED_PROXY_HOPS_MAX))).toBe(
      TRUSTED_PROXY_HOPS_MAX,
    );
  });

  it('refuses a value it cannot read as a bounded hop count', () => {
    expect(() => hopsFor('yes')).toThrow('TRUST_PROXY must be a hop count');
    expect(() => hopsFor('-1')).toThrow('TRUST_PROXY must be a hop count');
    expect(() => hopsFor(String(TRUSTED_PROXY_HOPS_MAX + 1))).toThrow(
      'TRUST_PROXY must be a hop count',
    );
  });
});
