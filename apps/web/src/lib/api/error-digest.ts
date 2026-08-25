import type { ApiErrorEnvelope } from "@asobeast/shared";

const DIGEST_PREFIX = "ASOBEAST_API_ERROR";
const SEPARATOR = ";";

export interface ApiErrorDigest {
  statusCode: number;
  retryAfterSeconds: number | null;
}

export function writeApiErrorDigest(envelope: ApiErrorEnvelope): string {
  return [
    DIGEST_PREFIX,
    envelope.statusCode,
    envelope.retryAfterSeconds ?? "",
  ].join(SEPARATOR);
}

export function readApiErrorDigest(
  digest: string | undefined,
): ApiErrorDigest | null {
  if (digest === undefined) return null;

  const [prefix, status, retryAfter] = digest.split(SEPARATOR);
  if (prefix !== DIGEST_PREFIX) return null;

  const statusCode = Number(status);
  if (!Number.isInteger(statusCode)) return null;

  const seconds = Number(retryAfter);
  return {
    statusCode,
    retryAfterSeconds:
      retryAfter !== "" && Number.isInteger(seconds) ? seconds : null,
  };
}
