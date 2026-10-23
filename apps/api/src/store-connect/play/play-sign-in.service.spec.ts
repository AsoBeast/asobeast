import { randomBytes } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SecretBox } from '../../common/crypto/secret-box';
import type { WorkspaceContext } from '../../common/tenancy/workspace-context';
import {
  STORE_CONNECT_OFF,
  type StoreConnectionService,
} from '../store-connection.service';
import {
  type GcsResponse,
  type GcsTransport,
  GcsUnreachableError,
} from './gcs-transport';
import {
  CLIENT_REFUSED,
  type GoogleOAuthClient,
  SIGN_IN_OFF,
} from './google-sign-in';
import {
  PlaySignIn,
  SIGN_IN_EXPIRED,
  SIGN_IN_REFUSED,
  STORAGE_SCOPE_MISSING,
} from './play-sign-in.service';
import { GCS_READ_ONLY_SCOPE } from './service-account';
import { sealSignInState } from './sign-in-state';

const BUCKET = 'pubsite_prod_4855979533719537120';
const CLIENT: GoogleOAuthClient = {
  id: 'client.apps.googleusercontent.com',
  secret: 'test-oauth-client-secret',
  redirectUri: 'https://aso.example.com/settings/google-play',
};
const ID_TOKEN = `e30.${Buffer.from(JSON.stringify({ email: 'owner@example.com', sub: '1098765' })).toString('base64url')}.sig`;
const GRANTED: GcsResponse = {
  status: 200,
  body: {
    refresh_token: '1//refresh',
    id_token: ID_TOKEN,
    scope: `openid email ${GCS_READ_ONLY_SCOPE}`,
  },
};

function harness({
  box = new SecretBox(randomBytes(32)),
  client = CLIENT,
  reply = (): Promise<GcsResponse> => Promise.resolve(GRANTED),
}: {
  box?: SecretBox | null;
  client?: GoogleOAuthClient | null;
  reply?: GcsTransport;
} = {}) {
  const transport = jest.fn(reply);
  const connections = {
    connectGoogleAccount: jest.fn(() =>
      Promise.resolve({ store: 'GOOGLE_PLAY' }),
    ),
  };
  const workspace = { require: jest.fn(() => 'ws_1') };
  const signIn = new PlaySignIn(
    box,
    client,
    transport,
    workspace as unknown as WorkspaceContext,
    connections as unknown as StoreConnectionService,
  );
  const stateOf = (url: string) => new URL(url).searchParams.get('state')!;
  return { signIn, transport, connections, box, stateOf };
}

describe('PlaySignIn', () => {
  it('sends the owner to Google with a state only they can return', () => {
    const { signIn, stateOf } = harness();

    const { url } = signIn.start(BUCKET, 'user_1');

    expect(url).toMatch(
      /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/,
    );
    expect(stateOf(url)).not.toContain(BUCKET);
    expect(new URL(url).searchParams.get('code_challenge')).toMatch(
      /^[\w-]{43}$/,
    );
  });

  it('redeems the code with the verifier it sealed and connects the account', async () => {
    const { signIn, transport, connections, stateOf } = harness();
    const { url } = signIn.start(BUCKET, 'user_1');

    await signIn.complete({ code: '4/code', state: stateOf(url) }, 'user_1');

    const form = transport.mock.calls[0][0].form!;
    expect(form).toMatchObject({
      grant_type: 'authorization_code',
      code: '4/code',
      redirect_uri: CLIENT.redirectUri,
    });
    expect(form.code_verifier).toMatch(/^[\w-]{43}$/);
    expect(connections.connectGoogleAccount).toHaveBeenCalledWith(
      {
        email: 'owner@example.com',
        refreshToken: '1//refresh',
        bucket: BUCKET,
        canReply: false,
      },
      '1098765',
      'user_1',
    );
  });

  it('refuses a state of another owner or one that expired before calling Google', async () => {
    const { signIn, transport, box, stateOf } = harness();
    const { url } = signIn.start(BUCKET, 'user_1');
    const expired = sealSignInState(
      box!,
      { workspaceId: 'ws_1', userId: 'user_1' },
      {
        bucket: BUCKET,
        verifier: 'v',
        expiresAt: Date.now() - 1,
      },
    );

    for (const [state, userId] of [
      [stateOf(url), 'user_2'],
      [expired, 'user_1'],
    ]) {
      const completion = signIn.complete({ code: '4/code', state }, userId);
      await expect(completion).rejects.toBeInstanceOf(BadRequestException);
      await expect(completion).rejects.toThrow(SIGN_IN_EXPIRED);
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a code Google refuses',
      () => Promise.resolve({ status: 400, body: { error: 'invalid_grant' } }),
      BadRequestException,
      SIGN_IN_REFUSED,
    ],
    [
      'a client Google refuses',
      () => Promise.resolve({ status: 401, body: { error: 'invalid_client' } }),
      ConflictException,
      CLIENT_REFUSED,
    ],
    [
      'a redirect Google does not know',
      () =>
        Promise.resolve({
          status: 400,
          body: { error: 'redirect_uri_mismatch' },
        }),
      ConflictException,
      CLIENT_REFUSED,
    ],
    [
      'an answer without the storage scope',
      () =>
        Promise.resolve({
          ...GRANTED,
          body: { ...(GRANTED.body as object), scope: 'openid email' },
        }),
      UnprocessableEntityException,
      STORAGE_SCOPE_MISSING,
    ],
    [
      'a rate limit',
      () => Promise.resolve({ status: 429, body: null }),
      BadGatewayException,
      'Google answered 429',
    ],
    [
      'a Google error',
      () => Promise.resolve({ status: 503, body: null }),
      BadGatewayException,
      'Google answered 503',
    ],
    [
      'an answer without a refresh token',
      () =>
        Promise.resolve({ status: 200, body: { scope: GCS_READ_ONLY_SCOPE } }),
      BadGatewayException,
      'Google answered the sign in without',
    ],
    [
      'Google out of reach',
      () => Promise.reject(new GcsUnreachableError('timeout')),
      BadGatewayException,
      'Google did not answer: timeout',
    ],
  ])('answers %s and connects nothing', async (_, reply, type, message) => {
    const { signIn, connections, stateOf } = harness({ reply });
    const { url } = signIn.start(BUCKET, 'user_1');

    const completion = signIn.complete(
      { code: '4/code', state: stateOf(url) },
      'user_1',
    );

    await expect(completion).rejects.toBeInstanceOf(type);
    await expect(completion).rejects.toThrow(message);
    expect(connections.connectGoogleAccount).not.toHaveBeenCalled();
  });

  it('answers 409 while store connections or the OAuth client are off', async () => {
    const off = harness({ box: null }).signIn;
    const noClient = harness({ client: null }).signIn;

    expect(() => off.start(BUCKET, 'user_1')).toThrow(STORE_CONNECT_OFF);
    expect(() => noClient.start(BUCKET, 'user_1')).toThrow(ConflictException);
    await expect(
      noClient.complete({ code: 'c', state: 's' }, 'user_1'),
    ).rejects.toThrow(SIGN_IN_OFF);
  });
});
