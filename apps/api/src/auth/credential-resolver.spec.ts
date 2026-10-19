import type { Request } from 'express';
import { SESSION_COOKIE } from '@asobeast/shared';
import type { AuthService } from './auth.service';
import type { AccountUser, SessionClaims } from './auth.types';
import { CredentialResolver } from './credential-resolver';
import type { CredentialRateLimiter } from './rate-limit/credential-rate.limiter';

const USER = { workspaceId: 'ws_acme' } as AccountUser;
const CLAIMS: SessionClaims = { sub: 'user_1', sv: 0, jti: 'session_1' };
const ADDRESS = '203.0.113.7';

function requestWith(authorization?: string): Request {
  return {
    ip: ADDRESS,
    cookies: { [SESSION_COOKIE]: 'stale' },
    headers: authorization ? { authorization } : {},
  } as unknown as Request;
}

describe('CredentialResolver', () => {
  const verifySession = jest.fn<Promise<SessionClaims | null>, [unknown]>();
  const userOfSession = jest.fn<Promise<AccountUser | null>, [SessionClaims]>();
  const resolveToken = jest.fn<
    Promise<{ user: AccountUser; scope: 'write' } | null>,
    [unknown]
  >();
  const recordRejection = jest.fn<Promise<void>, [string]>();

  const resolver = new CredentialResolver(
    { verifySession, userOfSession, resolveToken } as unknown as AuthService,
    { recordRejection } as unknown as CredentialRateLimiter,
  );

  beforeEach(() => {
    verifySession.mockReset().mockResolvedValue(CLAIMS);
    userOfSession.mockReset().mockResolvedValue(null);
    resolveToken.mockReset().mockResolvedValue(null);
    recordRejection.mockReset().mockResolvedValue(undefined);
  });

  it('accepts a token beside a stale session without counting', async () => {
    resolveToken.mockResolvedValue({ user: USER, scope: 'write' });

    await expect(
      resolver.resolve(requestWith('Bearer asob_valid')),
    ).resolves.toEqual({
      user: USER,
      credential: 'token',
      tokenScope: 'write',
    });

    expect(recordRejection).not.toHaveBeenCalled();
  });

  it('counts a stale session beside a refused token once', async () => {
    await expect(
      resolver.resolve(requestWith('Bearer asob_unknown')),
    ).resolves.toBeNull();

    expect(recordRejection).toHaveBeenCalledTimes(1);
    expect(recordRejection).toHaveBeenCalledWith(`ip:${ADDRESS}`);
  });

  it('prefers a live session and never looks up the token', async () => {
    userOfSession.mockResolvedValue(USER);

    await expect(
      resolver.resolve(requestWith('Bearer asob_valid')),
    ).resolves.toEqual({
      user: USER,
      credential: 'session',
      sessionId: 'session_1',
    });

    expect(resolveToken).not.toHaveBeenCalled();
    expect(recordRejection).not.toHaveBeenCalled();
  });
});
