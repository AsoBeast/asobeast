import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE } from '@asobeast/shared';
import type { WorkspaceContext } from '../../common/tenancy/workspace-context';
import type { AuthService } from '../auth.service';
import type { AccountUser, SessionClaims } from '../auth.types';
import { CredentialResolver } from '../credential-resolver';
import type { CredentialRateLimiter } from '../rate-limit/credential-rate.limiter';
import { CredentialRateLimitError } from '../rate-limit/rate-limit.errors';
import { AuthGuard } from './auth.guard';

const USER = { workspaceId: 'ws_acme' } as AccountUser;
const CLAIMS: SessionClaims = { sub: 'user_1', sv: 0 };

interface FakeRequest {
  ip?: string;
  cookies: Record<string, string>;
  headers: Record<string, string>;
}

function contextFor(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const verifySession = jest.fn<Promise<SessionClaims | null>, [unknown]>();
  const userOfSession = jest.fn<Promise<AccountUser | null>, [SessionClaims]>();
  const resolveToken = jest.fn<
    Promise<{ user: AccountUser; scope: 'read' } | null>,
    [unknown]
  >();
  const recordRejection = jest.fn<Promise<void>, [string]>();
  const bind = jest.fn();

  const guard = new AuthGuard(
    new Reflector(),
    new CredentialResolver(
      { verifySession, userOfSession, resolveToken } as unknown as AuthService,
      { recordRejection } as unknown as CredentialRateLimiter,
    ),
    { bind } as unknown as WorkspaceContext,
  );

  beforeEach(() => {
    verifySession.mockReset().mockResolvedValue(null);
    userOfSession.mockReset().mockResolvedValue(null);
    resolveToken.mockReset().mockResolvedValue(null);
    recordRejection.mockReset().mockResolvedValue(undefined);
    bind.mockReset();
  });

  it('counts a rejected credential against the address that presented it', async () => {
    verifySession.mockResolvedValue(CLAIMS);
    const req = {
      ip: '203.0.113.7',
      cookies: { [SESSION_COOKIE]: 'stale' },
      headers: {},
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(recordRejection).toHaveBeenCalledWith('ip:203.0.113.7');
  });

  it('answers 429 when the address has spent its budget of rejections', async () => {
    recordRejection.mockRejectedValue(new CredentialRateLimitError(30));
    const req = {
      ip: '203.0.113.7',
      cookies: {},
      headers: { authorization: 'Bearer asob_unknown' },
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      CredentialRateLimitError,
    );
  });

  it('never counts a rejection that has no client address to count it against', async () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Bearer asob_unknown' },
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(recordRejection).not.toHaveBeenCalled();
  });

  it('never counts a session cookie that does not verify', async () => {
    const req = {
      ip: '203.0.113.7',
      cookies: { [SESSION_COOKIE]: 'signed-with-another-secret' },
      headers: {},
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(userOfSession).not.toHaveBeenCalled();
    expect(recordRejection).not.toHaveBeenCalled();
  });

  it.each([['Basic dXNlcjpwYXNz'], ['Bearer not-an-api-token']])(
    'never counts a cookie that does not verify beside %j',
    async (authorization) => {
      const req = {
        ip: '203.0.113.7',
        cookies: { [SESSION_COOKIE]: 'signed-with-another-secret' },
        headers: { authorization },
      };

      await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(recordRejection).not.toHaveBeenCalled();
    },
  );

  it('counts a rejected token that arrives beside a cookie that does not verify', async () => {
    const req = {
      ip: '203.0.113.7',
      cookies: { [SESSION_COOKIE]: 'signed-with-another-secret' },
      headers: { authorization: 'Bearer asob_unknown' },
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(recordRejection).toHaveBeenCalledWith('ip:203.0.113.7');
  });

  it('never counts a request that presented no credential', async () => {
    const req = { ip: '203.0.113.7', cookies: {}, headers: {} };

    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(recordRejection).not.toHaveBeenCalled();
  });

  it('admits an accepted credential without touching the rejection budget', async () => {
    resolveToken.mockResolvedValue({ user: USER, scope: 'read' });
    const req = {
      ip: '203.0.113.7',
      cookies: {},
      headers: { authorization: 'Bearer asob_known' },
    };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);

    expect(recordRejection).not.toHaveBeenCalled();
    expect(bind).toHaveBeenCalledWith('ws_acme');
  });
});
