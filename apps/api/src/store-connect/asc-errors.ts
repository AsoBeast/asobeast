import type { AscRequest, AscResponse } from './asc-transport';

export class AscError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AscRejectedKeyError extends AscError {}

export class AscForbiddenError extends AscError {}

export class AscRateLimitedError extends AscError {}

export class AscUnreachableError extends Error {
  constructor(reason: string) {
    super(`App Store Connect did not answer: ${reason}`);
    this.name = 'AscUnreachableError';
  }
}

export class AscSegmentSizeError extends Error {
  constructor(expected: number, received: number | null) {
    super(
      `A report segment arrived with ${received ?? 'more'} bytes instead of ${expected}`,
    );
    this.name = 'AscSegmentSizeError';
  }
}

const REQUEST_CREATION = '/v1/analyticsReportRequests';

interface AppleErrorBody {
  errors?: { code?: unknown; detail?: unknown; title?: unknown }[];
}

const firstError = (body: unknown) =>
  (body as AppleErrorBody | null)?.errors?.[0] ?? null;

const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export function errorOf(response: AscResponse, request: AscRequest): AscError {
  const error = firstError(response.body);
  const code = textOf(error?.code);
  const message =
    textOf(error?.detail) ??
    textOf(error?.title) ??
    `App Store Connect answered ${response.status}`;
  if (
    response.status === 403 &&
    request.method === 'POST' &&
    request.path === REQUEST_CREATION
  ) {
    return new AscForbiddenError(message, response.status, code);
  }
  if (response.status === 401 || response.status === 403) {
    return new AscRejectedKeyError(message, response.status, code);
  }
  if (response.status === 429) {
    return new AscRateLimitedError(message, response.status, code);
  }
  return new AscError(message, response.status, code);
}
