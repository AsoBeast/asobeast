import type { ApiErrorEnvelope } from "@asobeast/shared";

const DIGEST_PREFIX = "ASOBEAST_API_ERROR";
const SEPARATOR = ";";
const PLAN_REFUSAL = "plan";
const STATUS_PATTERN = /^[1-5][0-9]{2}$/;
const SECONDS_PATTERN = /^[0-9]+$/;

let occurrence = 0;

export interface ApiErrorDigest {
  statusCode: number;
  retryAfterSeconds: number | null;
  planRefusal: boolean;
}

type DigestSource = Pick<
  ApiErrorEnvelope,
  "statusCode" | "retryAfterSeconds" | "rateLimit"
>;

function honouredWait(seconds: number | undefined): number | null {
  if (seconds === undefined || !Number.isInteger(seconds)) return null;
  return seconds > 0 ? seconds : null;
}

export function apiErrorDigestOf(envelope: DigestSource): ApiErrorDigest {
  return {
    statusCode: envelope.statusCode,
    retryAfterSeconds: honouredWait(envelope.retryAfterSeconds),
    planRefusal: envelope.rateLimit !== undefined,
  };
}

export function writeApiErrorDigest(envelope: DigestSource): string {
  const { statusCode, retryAfterSeconds, planRefusal } =
    apiErrorDigestOf(envelope);
  occurrence += 1;
  return [
    DIGEST_PREFIX,
    statusCode,
    retryAfterSeconds ?? "",
    planRefusal ? PLAN_REFUSAL : "",
    occurrence.toString(36),
  ].join(SEPARATOR);
}

function statusFrom(value: string | undefined): number | null {
  return value !== undefined && STATUS_PATTERN.test(value)
    ? Number(value)
    : null;
}

function secondsFrom(value: string | undefined): number | null {
  return value !== undefined && SECONDS_PATTERN.test(value)
    ? honouredWait(Number(value))
    : null;
}

export function readApiErrorDigest(
  digest: string | undefined,
): ApiErrorDigest | null {
  if (digest === undefined) return null;

  const [prefix, status, retryAfter, refusal] = digest.split(SEPARATOR);
  if (prefix !== DIGEST_PREFIX) return null;

  const statusCode = statusFrom(status);
  if (statusCode === null) return null;

  return {
    statusCode,
    retryAfterSeconds: secondsFrom(retryAfter),
    planRefusal: refusal === PLAN_REFUSAL,
  };
}
