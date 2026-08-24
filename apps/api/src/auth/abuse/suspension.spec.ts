import { refusesWhileSuspended } from './suspension';

const SUSPENDED = { suspendedAt: new Date('2026-08-14T00:00:00Z') };
const ACTIVE = { suspendedAt: null };

describe('refusesWhileSuspended', () => {
  it('lets an active workspace do anything', () => {
    expect(
      refusesWhileSuspended(ACTIVE, {
        credential: 'token',
        rateClass: 'store',
        allowedWhileUnentitled: false,
      }),
    ).toBe(false);
  });

  it('keeps a suspended workspace reading and exporting its own data', () => {
    expect(
      refusesWhileSuspended(SUSPENDED, {
        credential: 'session',
        rateClass: 'read',
        allowedWhileUnentitled: false,
      }),
    ).toBe(false);
  });

  it('keeps billing and account routes open so the customer can pay', () => {
    expect(
      refusesWhileSuspended(SUSPENDED, {
        credential: 'session',
        rateClass: 'write',
        allowedWhileUnentitled: true,
      }),
    ).toBe(false);
  });

  it('stops api access even for a read', () => {
    expect(
      refusesWhileSuspended(SUSPENDED, {
        credential: 'token',
        rateClass: 'read',
        allowedWhileUnentitled: false,
      }),
    ).toBe(true);
  });

  it('stops every write and every store request from the browser too', () => {
    for (const rateClass of ['write', 'store'] as const) {
      expect(
        refusesWhileSuspended(SUSPENDED, {
          credential: 'session',
          rateClass,
          allowedWhileUnentitled: false,
        }),
      ).toBe(true);
    }
  });
});
