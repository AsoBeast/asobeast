import { randomBytes } from 'node:crypto';
import { SecretBox } from '../../common/crypto/secret-box';
import {
  openSignInState,
  sealSignInState,
  type SignInState,
} from './sign-in-state';

const NOW = 1_792_000_000_000;
const STATE: SignInState = {
  bucket: 'pubsite_prod_4855979533719537120',
  verifier: 'verifier',
  expiresAt: NOW + 60_000,
};

const OWNER = { workspaceId: 'ws_1', userId: 'user_1' };

describe('sign in state', () => {
  const box = new SecretBox(randomBytes(32));
  const sealed = sealSignInState(box, OWNER, STATE);

  it('opens for the owner and workspace that sealed it', () => {
    expect(openSignInState(box, OWNER, sealed, NOW)).toEqual(STATE);
    expect(sealed).not.toContain(STATE.verifier);
  });

  it('never opens for another user or workspace', () => {
    expect(
      openSignInState(box, { ...OWNER, userId: 'user_2' }, sealed, NOW),
    ).toBeNull();
    expect(
      openSignInState(box, { ...OWNER, workspaceId: 'ws_2' }, sealed, NOW),
    ).toBeNull();
  });

  it('expires', () => {
    expect(openSignInState(box, OWNER, sealed, STATE.expiresAt)).toBeNull();
  });

  it('refuses a value that is not a sealed state', () => {
    const other = new SecretBox(randomBytes(32));
    const shapeless = box.seal('{"bucket":1}', 'play-sign-in:ws_1:user_1');
    const empty = box.seal('null', 'play-sign-in:ws_1:user_1');

    expect(openSignInState(box, OWNER, 'forged', NOW)).toBeNull();
    expect(openSignInState(other, OWNER, sealed, NOW)).toBeNull();
    expect(openSignInState(box, OWNER, shapeless, NOW)).toBeNull();
    expect(openSignInState(box, OWNER, empty, NOW)).toBeNull();
  });
});
