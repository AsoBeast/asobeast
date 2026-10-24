import type { SecretBox } from '../../common/crypto/secret-box';

export const SIGN_IN_STATE_TTL_MS = 10 * 60 * 1000;

export interface SignInState {
  bucket: string;
  verifier: string;
  expiresAt: number;
}

export interface SignInOwner {
  workspaceId: string;
  userId: string;
}

const contextOf = ({ workspaceId, userId }: SignInOwner): string =>
  `play-sign-in:${workspaceId}:${userId}`;

const isSignInState = (value: unknown): value is SignInState =>
  typeof value === 'object' &&
  value !== null &&
  'bucket' in value &&
  typeof value.bucket === 'string' &&
  'verifier' in value &&
  typeof value.verifier === 'string' &&
  'expiresAt' in value &&
  typeof value.expiresAt === 'number';

export function sealSignInState(
  box: SecretBox,
  owner: SignInOwner,
  state: SignInState,
): string {
  return box.seal(JSON.stringify(state), contextOf(owner));
}

export function openSignInState(
  box: SecretBox,
  owner: SignInOwner,
  sealed: string,
  now: number = Date.now(),
): SignInState | null {
  try {
    const state: unknown = JSON.parse(box.open(sealed, contextOf(owner)));
    return isSignInState(state) && state.expiresAt > now ? state : null;
  } catch {
    return null;
  }
}
