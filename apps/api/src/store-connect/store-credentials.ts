import type { Store } from '@asobeast/shared';
import { SecretBox, SecretBoxError } from '../common/crypto/secret-box';
import type { AscCredentials } from './asc-token';

export const credentialContext = (workspaceId: string, store: Store): string =>
  `store-connection:${workspaceId}:${store}`;

export function sealCredentials(
  box: SecretBox,
  workspaceId: string,
  store: Store,
  credentials: AscCredentials,
): string {
  return box.seal(
    JSON.stringify(credentials),
    credentialContext(workspaceId, store),
  );
}

const isCredentials = (value: unknown): value is AscCredentials => {
  const candidate = value as Partial<Record<keyof AscCredentials, unknown>>;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof candidate.issuerId === 'string' &&
    typeof candidate.keyId === 'string' &&
    typeof candidate.privateKey === 'string'
  );
};

export function openCredentials(
  box: SecretBox,
  workspaceId: string,
  store: Store,
  sealed: string,
): AscCredentials {
  const opened: unknown = JSON.parse(
    box.open(sealed, credentialContext(workspaceId, store)),
  );
  if (!isCredentials(opened)) {
    throw new SecretBoxError('The sealed value is not a store credential');
  }
  return opened;
}

export const needsReseal = (box: SecretBox, sealed: string): boolean =>
  !box.isCurrent(sealed);
