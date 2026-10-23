import { createHash, randomBytes } from 'node:crypto';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLAY_SIGN_IN_PATH } from '@asobeast/shared';
import type { Env } from '../../config/env';
import { GCS_READ_ONLY_SCOPE, type GoogleGrant } from './service-account';

export const GOOGLE_AUTHORIZATION_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const PLAY_SIGN_IN_SCOPES = [
  'openid',
  'email',
  GCS_READ_ONLY_SCOPE,
] as const;
export const GOOGLE_OAUTH_CLIENT = Symbol('GOOGLE_OAUTH_CLIENT');
export const SIGN_IN_OFF =
  'Sign in with Google is off on this instance. Set GOOGLE_PLAY_OAUTH_CLIENT_ID, GOOGLE_PLAY_OAUTH_CLIENT_SECRET and WEB_PUBLIC_URL to turn it on, or connect a service account key.';

export const CLIENT_REFUSED = `Google refused the OAuth client of this instance. Check GOOGLE_PLAY_OAUTH_CLIENT_ID and GOOGLE_PLAY_OAUTH_CLIENT_SECRET, and that WEB_PUBLIC_URL followed by ${PLAY_SIGN_IN_PATH} is an authorized redirect URI of that client.`;
const CLIENT_ERRORS = new Set([
  'invalid_client',
  'unauthorized_client',
  'redirect_uri_mismatch',
]);
const CREDENTIAL_ERRORS = new Set(['invalid_grant', ...CLIENT_ERRORS]);

export const isClientRefusal = (code: string | null): boolean =>
  code !== null && CLIENT_ERRORS.has(code);

export const isCredentialRefusal = (code: string | null): boolean =>
  code !== null && CREDENTIAL_ERRORS.has(code);

export function oauthErrorOf(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === 'string' ? error : null;
}

export interface GoogleOAuthClient {
  id: string;
  secret: string;
  redirectUri: string;
}

export interface SignedInAccount {
  email: string;
  subject: string;
  refreshToken: string;
}

export class SignInOffError extends Error {
  constructor() {
    super(SIGN_IN_OFF);
    this.name = 'SignInOffError';
  }
}

export class MissingStorageScopeError extends Error {
  constructor() {
    super('Google did not grant the Cloud Storage scope');
    this.name = 'MissingStorageScopeError';
  }
}

export class UnreadableSignInError extends Error {
  constructor(missing: string) {
    super(`Google answered the sign in without ${missing}`);
    this.name = 'UnreadableSignInError';
  }
}

export const googleOAuthClientProvider: Provider = {
  provide: GOOGLE_OAUTH_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): GoogleOAuthClient | null => {
    const id = config.get('GOOGLE_PLAY_OAUTH_CLIENT_ID', { infer: true });
    const secret = config.get('GOOGLE_PLAY_OAUTH_CLIENT_SECRET', {
      infer: true,
    });
    const origin = config.get('WEB_PUBLIC_URL', { infer: true });
    if (!id || !secret || !origin) return null;
    return {
      id,
      secret,
      redirectUri: new URL(PLAY_SIGN_IN_PATH, origin).toString(),
    };
  },
};

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

export function authorizationUrl(
  client: GoogleOAuthClient,
  state: string,
  challenge: string,
): string {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: client.id,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: PLAY_SIGN_IN_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export const authorizationCodeGrant = (
  client: GoogleOAuthClient,
  code: string,
  verifier: string,
): Record<string, string> => ({
  grant_type: 'authorization_code',
  code,
  code_verifier: verifier,
  client_id: client.id,
  client_secret: client.secret,
  redirect_uri: client.redirectUri,
});

export const refreshTokenGrant =
  (client: GoogleOAuthClient | null, refreshToken: string): GoogleGrant =>
  () => {
    if (!client) throw new SignInOffError();
    return {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: client.id,
      client_secret: client.secret,
    };
  };

const textOf = (record: Record<string, unknown>, field: string): string => {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new UnreadableSignInError(field);
  }
  return value;
};

function claimsOf(idToken: string): Record<string, unknown> {
  let payload: unknown = null;
  try {
    payload = JSON.parse(
      Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
    );
  } catch {
    payload = null;
  }
  if (typeof payload !== 'object' || payload === null) {
    throw new UnreadableSignInError('a readable id_token');
  }
  return payload as Record<string, unknown>;
}

export function signedInAccount(body: unknown): SignedInAccount {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new UnreadableSignInError('a readable token answer');
  }
  const answer = body as Record<string, unknown>;
  const scopes =
    typeof answer.scope === 'string' ? answer.scope.split(' ') : [];
  if (!scopes.includes(GCS_READ_ONLY_SCOPE)) {
    throw new MissingStorageScopeError();
  }
  const claims = claimsOf(textOf(answer, 'id_token'));
  return {
    email: textOf(claims, 'email'),
    subject: textOf(claims, 'sub'),
    refreshToken: textOf(answer, 'refresh_token'),
  };
}
