import { randomBytes } from 'node:crypto';
import { SecretBox, SecretBoxError } from '../common/crypto/secret-box';
import {
  credentialContext,
  needsReseal,
  openCredentials,
  sealCredentials,
} from './store-credentials';

const CREDENTIALS = {
  issuerId: '57246542-96fe-1a63-e053-0824d011072a',
  keyId: '2X9R4HXF34',
  privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
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
