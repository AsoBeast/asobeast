import {
  GcsBucketError,
  GcsRejectedError,
  GcsTokenRefusedError,
  type PlayAccount,
} from './gcs-api';
import { CLIENT_REFUSED, isClientRefusal } from './google-sign-in';

export const bucketMissing = (bucket: string): string =>
  `Google Cloud Storage has no bucket ${bucket}. Copy the Cloud Storage URI from Download reports in Play Console: the bucket id is the part after gs:// that starts with pubsite_prod.`;

function tokenRefused(
  { kind, email }: PlayAccount,
  code: string | null,
): string {
  if (kind === 'key') {
    return `Google refused the key of ${email}. It was deleted or disabled in Google Cloud, or the service account was removed. Create a new JSON key and connect it.`;
  }
  if (isClientRefusal(code)) return CLIENT_REFUSED;
  return `Google no longer accepts the sign in of ${email}. It was revoked, or it expired because the Google Cloud OAuth app is still in testing. Sign in with Google again.`;
}

const accessRefused = ({ kind, email }: PlayAccount, bucket: string): string =>
  kind === 'googleAccount'
    ? `Your Google account ${email} cannot read ${bucket}. Sign in with the account that owns the Play Console developer account, or one with View app information and download bulk reports on the Account permissions tab of Users and permissions.`
    : `Google refused ${email} access to ${bucket}. In Play Console, open Users and permissions and give this email View app information and download bulk reports on the Account permissions tab, not only on single apps. Google can take up to two days to apply a new permission.`;

export function playRefusal(
  error: unknown,
  api: { account: PlayAccount; bucket: string },
): string | null {
  if (error instanceof GcsTokenRefusedError) {
    return tokenRefused(api.account, error.code);
  }
  if (error instanceof GcsRejectedError) {
    return accessRefused(api.account, api.bucket);
  }
  if (error instanceof GcsBucketError) return bucketMissing(api.bucket);
  return null;
}
