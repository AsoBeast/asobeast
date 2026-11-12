import { Store } from '@prisma/client';

const STORE_NAMES: Record<Store, string> = {
  APP_STORE: 'The App Store',
  GOOGLE_PLAY: 'Google Play',
};

export const TRANSPORT_MESSAGES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR',
  'socket hang up',
  'tunneling socket',
  'timeout',
  'fetch failed',
  'rate limited',
] as const;

export const TRANSPORT_STATUSES = [429, 503] as const;

const STATUSES = TRANSPORT_STATUSES.join('|');

const TRANSPORT_STATUS = new RegExp(
  `(?:status|http)\\s+(?:${STATUSES})(?!\\d)`,
  'i',
);

export class StoreRequestError extends Error {
  constructor(
    readonly store: Store,
    readonly method: string,
    readonly causeMessage: string,
  ) {
    super(`${store} ${method} failed: ${causeMessage}`);
    this.name = 'StoreRequestError';
  }

  get userMessage(): string {
    return `${STORE_NAMES[this.store]} did not answer. Try again in a few minutes.`;
  }

  get unreachable(): boolean {
    const lowered = this.causeMessage.toLowerCase();
    return (
      TRANSPORT_STATUS.test(this.causeMessage) ||
      TRANSPORT_MESSAGES.some((marker) =>
        lowered.includes(marker.toLowerCase()),
      )
    );
  }
}

export class StoreAppNotFoundError extends Error {
  constructor(
    readonly store: Store,
    readonly storeAppId: string,
  ) {
    super(`${store} has no app ${storeAppId}`);
    this.name = 'StoreAppNotFoundError';
  }

  get userMessage(): string {
    return `${STORE_NAMES[this.store]} has no app ${this.storeAppId}.`;
  }
}

export class UnsearchableAppError extends Error {
  constructor(readonly title: string) {
    super(
      `${title} is not available on iPhone, so it cannot rank in the iPhone App Store search that asobeast reads`,
    );
    this.name = 'UnsearchableAppError';
  }
}

export class ImplausibleResultError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly store: Store,
    readonly detail: string,
    options: { retryable?: boolean } = {},
  ) {
    super(`${store} returned an implausible result: ${detail}`);
    this.name = 'ImplausibleResultError';
    this.retryable = options.retryable ?? false;
  }
}

export class StoreNotSupportedError extends Error {
  constructor(readonly store: Store) {
    super(`Store ${store} is not supported`);
    this.name = 'StoreNotSupportedError';
  }
}

export class ScreenshotFetchError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ScreenshotFetchError';
  }
}
