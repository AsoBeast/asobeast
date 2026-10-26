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

export class AscAgreementError extends AscRejectedKeyError {}

const AGREEMENT_CODE = 'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED';

export class AscForbiddenError extends AscError {}

export class AscRateLimitedError extends AscError {}

export class AscUnreachableError extends Error {
  constructor(reason: string) {
    super(`App Store Connect did not answer: ${reason}`);
    this.name = 'AscUnreachableError';
  }
}

export const isSkippableError = (error: unknown): boolean =>
  error instanceof AscUnreachableError ||
  (error instanceof AscError &&
    !(error instanceof AscRejectedKeyError) &&
    !(error instanceof AscRateLimitedError));

export class AscSegmentSizeError extends Error {
  constructor(expected: number, received: number | null) {
    super(
      `A report segment arrived with ${received ?? 'more'} bytes instead of ${expected}`,
    );
    this.name = 'AscSegmentSizeError';
  }
}

const NOT_FOUND = 404;
const CONFLICT = 409;

const answered = (error: unknown, status: number): boolean =>
  error instanceof AscError && error.status === status;

export const isNotFound = (error: unknown): boolean =>
  answered(error, NOT_FOUND);

export const isConflict = (error: unknown): boolean =>
  answered(error, CONFLICT);

const REQUEST_CREATION = '/v1/analyticsReportRequests';
const FORBIDDEN_CODE_PREFIX = 'FORBIDDEN';
const REVIEW_RESOURCE =
  /^\/v1\/(customerReviewResponses|customerReviews|apps\/[^/]+\/customerReviews)(\/|\?|$)/;

const isRoleRefusal = (
  response: AscResponse,
  request: AscRequest,
  code: string | null,
): boolean =>
  response.status === 403 &&
  ((request.method === 'POST' && request.path === REQUEST_CREATION) ||
    (REVIEW_RESOURCE.test(request.path) &&
      code?.startsWith(FORBIDDEN_CODE_PREFIX) === true));

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
  if (request.absoluteUrl !== undefined) {
    return new AscError(message, response.status, code);
  }
  if (code === AGREEMENT_CODE) {
    return new AscAgreementError(message, response.status, code);
  }
  if (isRoleRefusal(response, request, code)) {
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
