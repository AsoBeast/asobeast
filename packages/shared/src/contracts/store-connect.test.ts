import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  STORE_CONNECTION_STATUSES,
  STORE_CONNECTION_SYNC_OUTCOMES,
  STORE_REPORT_ACCESS,
  STORE_REPLY_ACCESS,
  STORE_REPORT_STATES,
  type AppStoreConnectionRequest,
  type PlayConnectionRequest,
  PLAY_REPLIES_NEED_CONSENT,
  PLAY_SIGN_IN_PATH,
  type PlaySignInCompletion,
  type StoreConnectionState,
  type StoreCredentialKind,
  STORE_CREDENTIAL_KINDS,
  type StoreConnectionItem,
  type StoreConnectionRequest,
  type StoreReplyAccess,
} from './store-connect';

describe('store connection contract', () => {
  it('names the states a connection and a report request can be in', () => {
    expect(STORE_CONNECTION_STATUSES).toEqual(['active', 'rejected']);
    expect(STORE_REPORT_ACCESS).toEqual(['unknown', 'admin', 'readOnly']);
    expect(STORE_REPORT_STATES).toEqual([
      'requested',
      'unmatched',
      'forbidden',
      'stopped',
    ]);
    expect(STORE_CONNECTION_SYNC_OUTCOMES).toEqual(['queued', 'running']);
  });

  it('types an app store connection request', () => {
    expectTypeOf<
      AppStoreConnectionRequest['store']
    >().toEqualTypeOf<'APP_STORE'>();
    expectTypeOf<
      AppStoreConnectionRequest['privateKey']
    >().toEqualTypeOf<string>();
  });

  it('types a play connection request by its store', () => {
    expectTypeOf<
      PlayConnectionRequest['store']
    >().toEqualTypeOf<'GOOGLE_PLAY'>();
    expectTypeOf<StoreConnectionRequest>().toEqualTypeOf<
      AppStoreConnectionRequest | PlayConnectionRequest
    >();
    const request: StoreConnectionRequest = {
      store: 'GOOGLE_PLAY',
      serviceAccountJson: '{}',
      bucket: 'pubsite_prod_rev_01234567890987654321',
    };
    expect(request.store).toBe('GOOGLE_PLAY');
  });

  it('keeps the bucket optional on the item', () => {
    expectTypeOf<StoreConnectionItem['bucket']>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it('names the three reply access values', () => {
    expect(STORE_REPLY_ACCESS).toEqual(['unknown', 'allowed', 'forbidden']);
  });

  it('keeps replyAccess optional on the item', () => {
    expectTypeOf<StoreConnectionItem['replyAccess']>().toEqualTypeOf<
      StoreReplyAccess | undefined
    >();
  });

  it('marks how a connection signed in, absent meaning a key', () => {
    expect(STORE_CREDENTIAL_KINDS).toEqual(['key', 'googleAccount']);
    expectTypeOf<StoreConnectionItem['credential']>().toEqualTypeOf<
      StoreCredentialKind | undefined
    >();
    expectTypeOf<StoreConnectionState['googleSignIn']>().toEqualTypeOf<
      boolean | undefined
    >();
  });

  it('tells a google sign in without play console access how to allow replies', () => {
    expect(PLAY_REPLIES_NEED_CONSENT).toBe(
      'This Google sign in was not allowed to manage Play Console, so it cannot post replies. Sign in with Google again and allow it, or connect a service account key with the Reply to reviews permission.',
    );
  });

  it('returns Google to one settings page with the code and state', () => {
    expect(PLAY_SIGN_IN_PATH).toBe('/settings/google-play');
    expectTypeOf<PlaySignInCompletion>().toEqualTypeOf<{
      code: string;
      state: string;
    }>();
  });

  it('never types the private key into the connection item', () => {
    expectTypeOf<StoreConnectionItem>().not.toHaveProperty('privateKey');
    expectTypeOf<StoreConnectionItem>().not.toHaveProperty(
      'credentialCiphertext',
    );
  });
});
