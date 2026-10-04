import { refusesWhileSuspended, type SuspendedRequest } from './suspension';

const SUSPENDED = { suspendedAt: new Date('2026-08-14T00:00:00Z') };
const ACTIVE = { suspendedAt: null };

function request(overrides: Partial<SuspendedRequest> = {}): SuspendedRequest {
  return {
    credential: 'session',
    rateClass: 'read',
    allowedWhileUnentitled: false,
    exportsWorkspaceData: false,
    ...overrides,
  };
}

describe('refusesWhileSuspended', () => {
  it('lets an active workspace do anything', () => {
    expect(
      refusesWhileSuspended(
        ACTIVE,
        request({ credential: 'token', rateClass: 'store' }),
      ),
    ).toBe(false);
  });

  it('keeps a suspended workspace reading and exporting its own data', () => {
    expect(refusesWhileSuspended(SUSPENDED, request())).toBe(false);
  });

  it('keeps billing and account routes open so the customer can pay', () => {
    expect(
      refusesWhileSuspended(
        SUSPENDED,
        request({ rateClass: 'write', allowedWhileUnentitled: true }),
      ),
    ).toBe(false);
  });

  it('stops api access even for a read', () => {
    expect(
      refusesWhileSuspended(SUSPENDED, request({ credential: 'token' })),
    ).toBe(true);
  });

  it('stops a token on an account route that a browser session may use', () => {
    expect(
      refusesWhileSuspended(
        SUSPENDED,
        request({ credential: 'token', allowedWhileUnentitled: true }),
      ),
    ).toBe(true);
  });

  it('lets a token take the workspace data out', () => {
    expect(
      refusesWhileSuspended(
        SUSPENDED,
        request({
          credential: 'token',
          allowedWhileUnentitled: true,
          exportsWorkspaceData: true,
        }),
      ),
    ).toBe(false);
  });

  it('stops a request with no credential on an account route', () => {
    expect(
      refusesWhileSuspended(
        SUSPENDED,
        request({ credential: undefined, allowedWhileUnentitled: true }),
      ),
    ).toBe(true);
  });

  it('stops every write and every store request from the browser too', () => {
    for (const rateClass of ['write', 'store'] as const) {
      expect(refusesWhileSuspended(SUSPENDED, request({ rateClass }))).toBe(
        true,
      );
    }
  });
});
