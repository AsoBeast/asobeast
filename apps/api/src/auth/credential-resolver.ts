import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE, type ApiTokenScope } from '@asobeast/shared';
import { AuthService } from './auth.service';
import type { AccountUser, AuthCredential } from './auth.types';
import { apiToken } from './bearer-token';
import { CredentialRateLimiter } from './rate-limit/credential-rate.limiter';
import { addressTrackerOf } from './rate-limit/request-tracker';

export interface ResolvedCredential {
  user: AccountUser;
  credential: AuthCredential;
  tokenScope?: ApiTokenScope;
}

@Injectable()
export class CredentialResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly credentials: CredentialRateLimiter,
  ) {}

  async resolve(req: Request): Promise<ResolvedCredential | null> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const claims = await this.auth.verifySession(cookies?.[SESSION_COOKIE]);
    const session = claims && (await this.auth.userOfSession(claims));
    if (session) return { user: session, credential: 'session' };

    const token = await this.auth.resolveToken(req.headers.authorization);
    if (token) {
      return { user: token.user, credential: 'token', tokenScope: token.scope };
    }

    const lookedUp = Boolean(claims || apiToken(req.headers.authorization));
    const address = addressTrackerOf(req);
    if (lookedUp && address) await this.credentials.recordRejection(address);
    return null;
  }
}
