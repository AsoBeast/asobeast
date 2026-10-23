import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  authorizationCodeGrant,
  authorizationUrl,
  type GoogleOAuthClient,
  googleOAuthClientProvider,
  isClientRefusal,
  isCredentialRefusal,
  MissingStorageScopeError,
  oauthErrorOf,
  pkcePair,
  refreshTokenGrant,
  SignInOffError,
  signedInAccount,
  UnreadableSignInError,
} from './google-sign-in';
import { GCS_READ_ONLY_SCOPE } from './service-account';

const CLIENT: GoogleOAuthClient = {
  id: 'client.apps.googleusercontent.com',
  secret: 'GOCSPX-secret',
  redirectUri: 'https://aso.example.com/settings/google-play',
};

const idToken = (claims: unknown): string =>
  `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

const answer = (overrides: Record<string, unknown> = {}) => ({
  access_token: 'ya29.access',
  refresh_token: '1//refresh',
  scope: `openid ${GCS_READ_ONLY_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
  id_token: idToken({ email: 'owner@example.com', sub: '1098765' }),
  ...overrides,
});

const providerWith = (env: Record<string, string | undefined>) =>
  (
    googleOAuthClientProvider as {
      useFactory: (config: ConfigService) => GoogleOAuthClient | null;
    }
  ).useFactory({ get: (name: string) => env[name] } as ConfigService);

describe('googleOAuthClientProvider', () => {
  it('builds the client with the settings page as the redirect', () => {
    expect(
      providerWith({
        GOOGLE_PLAY_OAUTH_CLIENT_ID: CLIENT.id,
        GOOGLE_PLAY_OAUTH_CLIENT_SECRET: CLIENT.secret,
        WEB_PUBLIC_URL: 'https://aso.example.com',
      }),
    ).toEqual(CLIENT);
  });

  it.each([
    'GOOGLE_PLAY_OAUTH_CLIENT_ID',
    'GOOGLE_PLAY_OAUTH_CLIENT_SECRET',
    'WEB_PUBLIC_URL',
  ])('is off without %s', (name) => {
    const env: Record<string, string | undefined> = {
      GOOGLE_PLAY_OAUTH_CLIENT_ID: CLIENT.id,
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: CLIENT.secret,
      WEB_PUBLIC_URL: 'https://aso.example.com',
      [name]: undefined,
    };

    expect(providerWith(env)).toBeNull();
  });
});

describe('authorizationUrl', () => {
  it('asks for offline read only storage access with a PKCE challenge', () => {
    const url = new URL(authorizationUrl(CLIENT, 'sealed.state', 'challenge'));

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT.id,
      redirect_uri: CLIENT.redirectUri,
      response_type: 'code',
      scope: `openid email ${GCS_READ_ONLY_SCOPE}`,
      access_type: 'offline',
      prompt: 'consent',
      state: 'sealed.state',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
  });
});

describe('pkcePair', () => {
  it('derives the S256 challenge from a fresh verifier', () => {
    const first = pkcePair();
    const second = pkcePair();

    expect(first.verifier).toMatch(/^[\w-]{43}$/);
    expect(first.challenge).toBe(
      createHash('sha256').update(first.verifier).digest('base64url'),
    );
    expect(second.verifier).not.toBe(first.verifier);
  });
});

describe('grants', () => {
  it('redeems a code with the verifier and the same redirect', () => {
    expect(authorizationCodeGrant(CLIENT, '4/code', 'verifier')).toEqual({
      grant_type: 'authorization_code',
      code: '4/code',
      code_verifier: 'verifier',
      client_id: CLIENT.id,
      client_secret: CLIENT.secret,
      redirect_uri: CLIENT.redirectUri,
    });
  });

  it('refreshes with the client of the instance', () => {
    expect(refreshTokenGrant(CLIENT, '1//refresh')(new Date())).toEqual({
      grant_type: 'refresh_token',
      refresh_token: '1//refresh',
      client_id: CLIENT.id,
      client_secret: CLIENT.secret,
    });
  });

  it('refuses to refresh once the instance has no client', () => {
    expect(() => refreshTokenGrant(null, '1//refresh')(new Date())).toThrow(
      SignInOffError,
    );
  });
});

describe('oauth errors', () => {
  it('reads the error code of a token answer', () => {
    expect(oauthErrorOf({ error: 'invalid_grant' })).toBe('invalid_grant');
    expect(oauthErrorOf({ error: 7 })).toBeNull();
    expect(oauthErrorOf(null)).toBeNull();
  });

  it.each([
    ['invalid_client', true],
    ['unauthorized_client', true],
    ['redirect_uri_mismatch', true],
    ['invalid_grant', false],
    [null, false],
  ])('treats %s as a refusal of the client: %s', (code, refused) => {
    expect(isClientRefusal(code)).toBe(refused);
  });

  it.each([
    ['invalid_grant', true],
    ['invalid_client', true],
    ['rate_limit_exceeded', false],
    [null, false],
  ])('treats %s as a refused credential: %s', (code, refused) => {
    expect(isCredentialRefusal(code)).toBe(refused);
  });
});

describe('signedInAccount', () => {
  it('reads the email and subject of the id token and the refresh token', () => {
    expect(signedInAccount(answer())).toEqual({
      email: 'owner@example.com',
      subject: '1098765',
      refreshToken: '1//refresh',
    });
  });

  it('refuses an answer whose granted scopes leave out storage', () => {
    expect(() => signedInAccount(answer({ scope: 'openid email' }))).toThrow(
      MissingStorageScopeError,
    );
    expect(() => signedInAccount(answer({ scope: undefined }))).toThrow(
      MissingStorageScopeError,
    );
  });

  it.each([
    ['no refresh token', { refresh_token: undefined }],
    ['no id token', { id_token: undefined }],
    ['an id token that is not JSON', { id_token: 'a.b.c' }],
    ['an id token without email', { id_token: idToken({ sub: '1' }) }],
    ['an id token of null', { id_token: idToken(null) }],
  ])('refuses an answer with %s', (_, overrides) => {
    expect(() => signedInAccount(answer(overrides))).toThrow(
      UnreadableSignInError,
    );
  });

  it.each([['<html>'], [[answer()]], [null]])(
    'refuses a body that is not a token answer: %p',
    (body) => {
      expect(() => signedInAccount(body)).toThrow(UnreadableSignInError);
    },
  );
});
