import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  STORE_CONNECTION_STATUSES,
  STORE_CONNECTION_SYNC_OUTCOMES,
  STORE_REPORT_ACCESS,
  STORE_REPORT_STATES,
  type AppStoreConnectionRequest,
  type PlayConnectionRequest,
  type StoreConnectionItem,
  type StoreConnectionRequest,
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

  it('never types the private key into the connection item', () => {
    expectTypeOf<StoreConnectionItem>().not.toHaveProperty('privateKey');
    expectTypeOf<StoreConnectionItem>().not.toHaveProperty(
      'credentialCiphertext',
    );
  });
});
