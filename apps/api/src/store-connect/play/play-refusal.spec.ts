import {
  GcsBucketError,
  GcsError,
  GcsRateLimitedError,
  GcsRejectedError,
  GcsTokenRefusedError,
} from './gcs-api';
import { CLIENT_REFUSED, SIGN_IN_OFF, SignInOffError } from './google-sign-in';
import { bucketMissing, playRefusal } from './play-refusal';

const BUCKET = 'pubsite_prod_4855979533719537120';
const SERVICE_ACCOUNT = {
  account: { kind: 'key' as const, email: 'reports@x.iam.gserviceaccount.com' },
  bucket: BUCKET,
};
const GOOGLE_ACCOUNT = {
  account: { kind: 'googleAccount' as const, email: 'owner@example.com' },
  bucket: BUCKET,
};

describe('playRefusal', () => {
  it('sends a refused service account to the account permissions tab', () => {
    const message = playRefusal(
      new GcsRejectedError('no', 403),
      SERVICE_ACCOUNT,
    );

    expect(message).toContain(
      `Google refused reports@x.iam.gserviceaccount.com access to ${BUCKET}`,
    );
    expect(message).toContain('Account permissions tab');
    expect(message).not.toContain('bucket id');
  });

  it('tells a google account it cannot read the bucket', () => {
    expect(
      playRefusal(new GcsRejectedError('no', 403), GOOGLE_ACCOUNT),
    ).toContain(`Your Google account owner@example.com cannot read ${BUCKET}`);
  });

  it('names a refused key or a revoked sign in apart from the bucket', () => {
    const refused = new GcsTokenRefusedError('no', 400);

    expect(playRefusal(refused, SERVICE_ACCOUNT)).toContain(
      'Google refused the key of reports@x.iam.gserviceaccount.com',
    );
    expect(playRefusal(refused, GOOGLE_ACCOUNT)).toContain(
      'Google no longer accepts the sign in of owner@example.com',
    );
  });

  it('blames the OAuth client of the instance, not the sign in, when Google refuses the client', () => {
    expect(
      playRefusal(
        new GcsTokenRefusedError('no', 401, 'invalid_client'),
        GOOGLE_ACCOUNT,
      ),
    ).toBe(CLIENT_REFUSED);
    expect(
      playRefusal(
        new GcsTokenRefusedError('no', 400, 'invalid_grant'),
        GOOGLE_ACCOUNT,
      ),
    ).toContain('Google no longer accepts the sign in');
    expect(
      playRefusal(
        new GcsTokenRefusedError('no', 401, 'invalid_client'),
        SERVICE_ACCOUNT,
      ),
    ).toContain('Google refused the key of');
  });

  it('names the missing bucket and the switched off sign in', () => {
    expect(playRefusal(new GcsBucketError('no', 404), GOOGLE_ACCOUNT)).toBe(
      bucketMissing(BUCKET),
    );
    expect(playRefusal(new SignInOffError(), GOOGLE_ACCOUNT)).toBe(SIGN_IN_OFF);
  });

  it.each([
    new GcsRateLimitedError('slow', 429),
    new GcsError('busy', 503),
    new Error('boom'),
  ])('leaves %s to the caller', (error) => {
    expect(playRefusal(error, SERVICE_ACCOUNT)).toBeNull();
  });
});
