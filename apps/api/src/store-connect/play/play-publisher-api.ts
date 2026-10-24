import {
  GcsError,
  GcsRateLimitedError,
  GcsRejectedError,
  googleTokenExchange,
  isSuccess,
} from './gcs-api';
import type { GcsResponse, GcsTransport } from './gcs-transport';
import {
  GOOGLE_TOKEN_AUDIENCE,
  type GoogleGrant,
  GoogleTokenCache,
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

export class PlayApiDisabledError extends GcsError {
  constructor(
    message: string,
    status: number,
    readonly project: string | null,
  ) {
    super(message, status);
  }
}

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

interface GoogleErrorEntry {
  reason?: unknown;
  metadata?: { consumer?: unknown };
}

interface GoogleError {
  message?: unknown;
  errors?: unknown;
  details?: unknown;
}

const DISABLED_REASONS = new Set(['SERVICE_DISABLED', 'accessNotConfigured']);
const UNUSED_IN_PROJECT = /has not been used in project (\d+)/;
const CONSUMER_PROJECT = /^projects\/(\d+)$/;

const googleErrorOf = (body: unknown): GoogleError | null =>
  (body as { error?: GoogleError } | null)?.error ?? null;

const entriesOf = (value: unknown): GoogleErrorEntry[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is GoogleErrorEntry =>
          typeof entry === 'object' && entry !== null,
      )
    : [];

const googleMessage = (error: GoogleError | null): string | null =>
  typeof error?.message === 'string' && error.message.length > 0
    ? error.message
    : null;

const isServiceDisabled = (error: GoogleError | null, message: string) =>
  [...entriesOf(error?.errors), ...entriesOf(error?.details)].some(
    ({ reason }) => typeof reason === 'string' && DISABLED_REASONS.has(reason),
  ) || UNUSED_IN_PROJECT.test(message);

function disabledProject(
  error: GoogleError | null,
  message: string,
): string | null {
  const consumer = entriesOf(error?.details)
    .map((entry) => entry.metadata?.consumer)
    .find((value): value is string => typeof value === 'string');
  return (
    consumer?.match(CONSUMER_PROJECT)?.[1] ??
    message.match(UNUSED_IN_PROJECT)?.[1] ??
    null
  );
}

function forbiddenErrorOf(
  error: GoogleError | null,
  message: string,
  status: number,
): GcsError {
  return isServiceDisabled(error, message)
    ? new PlayApiDisabledError(message, status, disabledProject(error, message))
    : new PlayForbiddenError(message, status);
}

function replyErrorOf(response: GcsResponse): GcsError {
  const { status } = response;
  const error = googleErrorOf(response.body);
  const message =
    googleMessage(error) ?? `Google answered ${status} to the reply`;
  if (status === 400) return new PlayReplyRefusedError(message, status);
  if (status === 401) return new GcsRejectedError(message, status);
  if (status === 403) return forbiddenErrorOf(error, message, status);
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
    grant: GoogleGrant,
    private readonly origins: PlayPublisherOrigins = PLAY_PUBLISHER_ORIGINS,
  ) {
    this.tokens = new GoogleTokenCache(
      grant,
      googleTokenExchange(transport, origins.token),
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
