import type { Store } from '@asobeast/shared';
import { SecretBox, SecretBoxError } from '../common/crypto/secret-box';
import type { AscCredentials } from './asc-token';
import type { ServiceAccount } from './play/service-account';

export interface PlayCredentials extends ServiceAccount {
  bucket: string;
}

export type StoreCredentials = AscCredentials | PlayCredentials;

export const credentialContext = (workspaceId: string, store: Store): string =>
  `store-connection:${workspaceId}:${store}`;

const hasStrings = (value: unknown, fields: readonly string[]): boolean =>
  typeof value === 'object' &&
  value !== null &&
  fields.every(
    (field) => typeof (value as Record<string, unknown>)[field] === 'string',
  );

export const isAscCredentials = (value: unknown): value is AscCredentials =>
  hasStrings(value, ['issuerId', 'keyId', 'privateKey']);

export const isPlayCredentials = (value: unknown): value is PlayCredentials =>
  hasStrings(value, ['clientEmail', 'privateKeyId', 'privateKey', 'bucket']);

const SHAPES: Record<Store, (value: unknown) => boolean> = {
  APP_STORE: isAscCredentials,
  GOOGLE_PLAY: isPlayCredentials,
};

export function sealCredentials(
  box: SecretBox,
  workspaceId: string,
  store: Store,
  credentials: StoreCredentials,
): string {
  return box.seal(
    JSON.stringify(credentials),
    credentialContext(workspaceId, store),
  );
}

export function openCredentials(
  box: SecretBox,
  workspaceId: string,
  store: Store,
  sealed: string,
): StoreCredentials {
  const opened: unknown = JSON.parse(
    box.open(sealed, credentialContext(workspaceId, store)),
  );
  if (!SHAPES[store](opened)) {
    throw new SecretBoxError('The sealed value is not a store credential');
  }
  return opened as StoreCredentials;
}

export const needsReseal = (box: SecretBox, sealed: string): boolean =>
  !box.isCurrent(sealed);
