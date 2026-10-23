import { generateKeyPairSync } from 'node:crypto';
import { GcsError, GcsRateLimitedError, GcsRejectedError } from './gcs-api';
import {
  type GcsRequest,
  type GcsResponse,
  type GcsTransport,
  GcsUnreachableError,
} from './gcs-transport';
import {
  PlayForbiddenError,
  PlayPublisherApi,
  PlayReplyRefusedError,
  PlayReviewMissingError,
} from './play-publisher-api';
import {
  ANDROID_PUBLISHER_SCOPE,
  parseServiceAccount,
  serviceAccountGrant,
} from './service-account';

const ACCOUNT = parseServiceAccount(
  JSON.stringify({
    client_email: 'replies@asobeast-play.iam.gserviceaccount.com',
    private_key_id: 'kid',
    private_key: generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString(),
  }),
);

const TOKEN = { status: 200, body: { access_token: 'ya29', expires_in: 3600 } };
const REPLIED = {
  status: 200,
  body: {
    result: {
      replyText: 'Thank you',
      lastEdited: { seconds: '1792584000', nanos: 0 },
    },
  },
};

const googleError = (status: number, message: string): GcsResponse => ({
  status,
  body: { error: { code: status, message, status: 'FAILED' } },
});

function recorded(...responses: GcsResponse[]) {
  const requests: GcsRequest[] = [];
  const queue = [TOKEN, ...responses];
  const transport: GcsTransport = (request) => {
    requests.push(request);
    const next = queue.shift();
    return next
      ? Promise.resolve(next)
      : Promise.reject(new Error('no response queued'));
  };
  return {
    api: new PlayPublisherApi(
      transport,
      serviceAccountGrant(ACCOUNT, ANDROID_PUBLISHER_SCOPE),
    ),
    requests,
  };
}

const scopeOf = (request: GcsRequest): unknown =>
  (
    JSON.parse(
      Buffer.from(
        request.form?.assertion.split('.')[1] ?? '',
        'base64url',
      ).toString('utf8'),
    ) as { scope?: unknown }
  ).scope;

describe('PlayPublisherApi', () => {
  it('exchanges an assertion for the publisher scope once and reuses the token', async () => {
    const { api, requests } = recorded(REPLIED, REPLIED);

    await api.reply('com.example', 'gp:AOqp1', 'Thank you');
    await api.reply('com.example', 'gp:AOqp2', 'Thank you');

    expect(requests.map((request) => request.url)).toEqual([
      'https://oauth2.googleapis.com/token',
      expect.stringContaining('gp%3AAOqp1:reply'),
      expect.stringContaining('gp%3AAOqp2:reply'),
    ]);
    expect(scopeOf(requests[0])).toBe(ANDROID_PUBLISHER_SCOPE);
  });

  it('replies to a review', async () => {
    const { api, requests } = recorded(REPLIED);

    await expect(
      api.reply('com.example', 'gp:AOqp1', 'Thank you'),
    ).resolves.toEqual({
      replyText: 'Thank you',
      lastEdited: new Date('2026-10-21T12:00:00.000Z'),
    });
    expect(requests[1]).toEqual({
      method: 'POST',
      url: 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.example/reviews/gp%3AAOqp1:reply',
      bearer: 'ya29',
      json: { replyText: 'Thank you' },
    });
  });

  it("reads a 400 as the store's refusal with google's message", async () => {
    const { api } = recorded(googleError(400, 'Reply text is too long.'));

    const error: unknown = await api
      .reply('com.example', 'gp:AOqp1', 'x')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PlayReplyRefusedError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Reply text is too long.',
    });
  });

  it('reads a 404 as an unknown review', async () => {
    const { api } = recorded(googleError(404, 'Review not found.'));

    await expect(
      api.reply('com.example', 'gp:AOqp1', 'x'),
    ).rejects.toBeInstanceOf(PlayReviewMissingError);
  });

  it('reads a 403 as a missing permission', async () => {
    const { api } = recorded(googleError(403, 'The caller has no role.'));

    await expect(
      api.reply('com.example', 'gp:AOqp1', 'x'),
    ).rejects.toBeInstanceOf(PlayForbiddenError);
  });

  it('reads a 401 as a refused service account, not a missing permission', async () => {
    const { api } = recorded(googleError(401, 'Invalid credentials.'));

    const error: unknown = await api
      .reply('com.example', 'gp:AOqp1', 'x')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GcsRejectedError);
    expect(error).not.toBeInstanceOf(PlayForbiddenError);
  });

  it.each(['soon', '', '0', 0])(
    'dates a reply google answers with the edit time %j to now',
    async (seconds) => {
      const { api } = recorded({
        status: 200,
        body: { result: { replyText: 'x', lastEdited: { seconds } } },
      });
      const before = Date.now();

      const reply = await api.reply('com.example', 'gp:AOqp1', 'x');

      expect(reply.lastEdited.getTime()).toBeGreaterThanOrEqual(before);
    },
  );

  it('reads a 429 as a rate limit', async () => {
    const { api } = recorded(googleError(429, 'Quota exceeded.'));

    await expect(
      api.reply('com.example', 'gp:AOqp1', 'x'),
    ).rejects.toBeInstanceOf(GcsRateLimitedError);
  });

  it('keeps a server error as a plain google error with its status', async () => {
    const { api } = recorded({ status: 503, body: null });

    const error: unknown = await api
      .reply('com.example', 'gp:AOqp1', 'x')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GcsError);
    expect(error).toMatchObject({
      status: 503,
      message: 'Google answered 503 to the reply',
    });
  });

  it('maps an unreachable google', async () => {
    const transport: GcsTransport = (request) =>
      request.url.endsWith('/token')
        ? Promise.resolve(TOKEN)
        : Promise.reject(new GcsUnreachableError('timed out'));
    const api = new PlayPublisherApi(
      transport,
      serviceAccountGrant(ACCOUNT, ANDROID_PUBLISHER_SCOPE),
    );

    await expect(
      api.reply('com.example', 'gp:AOqp1', 'x'),
    ).rejects.toBeInstanceOf(GcsUnreachableError);
  });
});
