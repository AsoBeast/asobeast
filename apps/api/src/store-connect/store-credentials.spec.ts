import { randomBytes } from 'node:crypto';
import { SecretBox, SecretBoxError } from '../common/crypto/secret-box';
import {
  credentialContext,
  isGoogleAccountCredentials,
  isServiceAccountCredentials,
  needsReseal,
  openCredentials,
  sealCredentials,
} from './store-credentials';

const CREDENTIALS = {
  issuerId: '57246542-96fe-1a63-e053-0824d011072a',
  keyId: '2X9R4HXF34',
  privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
};

const PLAY_CREDENTIALS = {
  clientEmail: 'reports@focus-123.iam.gserviceaccount.com',
  privateKeyId: 'a1b2c3d4e5',
  privateKey: '-----BEGIN PRIVATE KEY-----\nrsa\n-----END PRIVATE KEY-----',
  bucket: 'pubsite_prod_rev_01234567890987654321',
};

const GOOGLE_ACCOUNT = {
  email: 'owner@example.com',
  refreshToken: '1//refresh',
  bucket: 'pubsite_prod_4855979533719537120',
};

describe('store credentials', () => {
  const box = new SecretBox(randomBytes(32));

  it('binds a credential to its workspace and store', () => {
    expect(credentialContext('ws_1', 'APP_STORE')).toBe(
      'store-connection:ws_1:APP_STORE',
    );
  });

  it('opens what it sealed for the same workspace and store', () => {
    const sealed = sealCredentials(box, 'ws_1', 'APP_STORE', CREDENTIALS);

    expect(sealed).not.toContain('PRIVATE KEY');
    expect(openCredentials(box, 'ws_1', 'APP_STORE', sealed)).toEqual(
      CREDENTIALS,
    );
  });

  it('refuses a ciphertext of another workspace or store', () => {
    const sealed = sealCredentials(box, 'ws_1', 'APP_STORE', CREDENTIALS);

    expect(() => openCredentials(box, 'ws_2', 'APP_STORE', sealed)).toThrow(
      SecretBoxError,
    );
    expect(() => openCredentials(box, 'ws_1', 'GOOGLE_PLAY', sealed)).toThrow(
      SecretBoxError,
    );
  });

  it('refuses a sealed value that is not a credential', () => {
    const sealed = box.seal(
      '{"issuerId":1}',
      'store-connection:ws_1:APP_STORE',
    );

    expect(() => openCredentials(box, 'ws_1', 'APP_STORE', sealed)).toThrow(
      SecretBoxError,
    );
  });

  it('opens a play credential and refuses an app store shape sealed for play', () => {
    const sealed = sealCredentials(
      box,
      'ws_1',
      'GOOGLE_PLAY',
      PLAY_CREDENTIALS,
    );
    const wrong = sealCredentials(box, 'ws_1', 'GOOGLE_PLAY', CREDENTIALS);

    expect(openCredentials(box, 'ws_1', 'GOOGLE_PLAY', sealed)).toEqual(
      PLAY_CREDENTIALS,
    );
    expect(() => openCredentials(box, 'ws_1', 'GOOGLE_PLAY', wrong)).toThrow(
      SecretBoxError,
    );
  });

  it('opens a google account credential sealed for play only', () => {
    const sealed = sealCredentials(box, 'ws_1', 'GOOGLE_PLAY', GOOGLE_ACCOUNT);
    const opened = openCredentials(box, 'ws_1', 'GOOGLE_PLAY', sealed);

    expect(opened).toEqual(GOOGLE_ACCOUNT);
    expect(isGoogleAccountCredentials(opened)).toBe(true);
    expect(isServiceAccountCredentials(opened)).toBe(false);
    expect(() =>
      openCredentials(
        box,
        'ws_1',
        'APP_STORE',
        sealCredentials(box, 'ws_1', 'APP_STORE', GOOGLE_ACCOUNT),
      ),
    ).toThrow(SecretBoxError);
  });

  it('needs resealing when sealed with the previous key', () => {
    const previous = randomBytes(32);
    const old = sealCredentials(
      new SecretBox(previous),
      'ws_1',
      'APP_STORE',
      CREDENTIALS,
    );
    const rotated = new SecretBox(randomBytes(32), previous);

    expect(needsReseal(rotated, old)).toBe(true);
    expect(
      needsReseal(
        rotated,
        sealCredentials(rotated, 'ws_1', 'APP_STORE', CREDENTIALS),
      ),
    ).toBe(false);
  });
});
