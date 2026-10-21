import {
  GcsError,
  GcsRateLimitedError,
  GcsRejectedError,
  googleTokenExchange,
  isSuccess,
} from './gcs-api';
import type { GcsResponse, GcsTransport } from './gcs-transport';
import {
  ANDROID_PUBLISHER_SCOPE,
  GOOGLE_TOKEN_AUDIENCE,
  GoogleTokenCache,
  type ServiceAccount,
} from './service-account';

export const PLAY_PUBLISHER_ORIGIN = 'https://androidpublisher.googleapis.com';

export interface PlayPublisherOrigins {
  token: string;
  publisher: string;
}

export const PLAY_PUBLISHER_ORIGINS: PlayPublisherOrigins = {
  token: GOOGLE_TOKEN_AUDIENCE,
  publisher: PLAY_PUBLISHER_ORIGIN,
};

export class PlayReplyRefusedError extends GcsError {}

export class PlayReviewMissingError extends GcsError {}

export class PlayForbiddenError extends GcsError {}

export interface PlayReply {
  replyText: string;
  lastEdited: Date;
}

interface ReplyAnswer {
  result?: {
    replyText?: string;
    lastEdited?: { seconds?: string | number };
  };
}

const googleMessage = (body: unknown): string | null => {
  const message = (body as { error?: { message?: unknown } } | null)?.error
    ?.message;
  return typeof message === 'string' && message.length > 0 ? message : null;
};

function replyErrorOf(response: GcsResponse): GcsError {
  const { status } = response;
  const message =
    googleMessage(response.body) ?? `Google answered ${status} to the reply`;
  if (status === 400) return new PlayReplyRefusedError(message, status);
  if (status === 401) return new GcsRejectedError(message, status);
  if (status === 403) return new PlayForbiddenError(message, status);
  if (status === 404) return new PlayReviewMissingError(message, status);
  if (status === 429) return new GcsRateLimitedError(message, status);
  return new GcsError(message, status);
}

const editedAt = (seconds: string | number | undefined): Date => {
  const epoch = Number(seconds);
  return Number.isFinite(epoch) && epoch > 0
    ? new Date(epoch * 1000)
    : new Date();
};

export class PlayPublisherApi {
  private readonly tokens: GoogleTokenCache;

  constructor(
    private readonly transport: GcsTransport,
    account: ServiceAccount,
    private readonly origins: PlayPublisherOrigins = PLAY_PUBLISHER_ORIGINS,
  ) {
    this.tokens = new GoogleTokenCache(
      account,
      googleTokenExchange(transport, origins.token),
      ANDROID_PUBLISHER_SCOPE,
    );
  }

  async reply(
    packageName: string,
    reviewId: string,
    text: string,
  ): Promise<PlayReply> {
    const response = await this.transport({
      method: 'POST',
      url: `${this.origins.publisher}/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/reviews/${encodeURIComponent(reviewId)}:reply`,
      bearer: await this.tokens.get(),
      json: { replyText: text },
    });
    if (!isSuccess(response)) throw replyErrorOf(response);
    const result = (response.body as ReplyAnswer | null)?.result;
    return {
      replyText: result?.replyText ?? text,
      lastEdited: editedAt(result?.lastEdited?.seconds),
    };
  }
}
