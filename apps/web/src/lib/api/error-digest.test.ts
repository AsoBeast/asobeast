import type { ApiErrorEnvelope } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { readApiErrorDigest, writeApiErrorDigest } from "./error-digest";

function envelope(
  statusCode: number,
  retryAfterSeconds?: number,
): ApiErrorEnvelope {
  return {
    statusCode,
    error: "Error",
    message: "Rate limit reached",
    path: "/portfolio",
    timestamp: "2026-08-25T10:30:26.118Z",
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

describe("api error digest", () => {
  it("carries the status and the wait across the boundary", () => {
    expect(readApiErrorDigest(writeApiErrorDigest(envelope(429, 4)))).toEqual({
      statusCode: 429,
      retryAfterSeconds: 4,
    });
  });

  it("carries a status the API gave no wait for", () => {
    expect(readApiErrorDigest(writeApiErrorDigest(envelope(404)))).toEqual({
      statusCode: 404,
      retryAfterSeconds: null,
    });
  });

  it("never carries the message or the path", () => {
    const written = writeApiErrorDigest(envelope(429, 4));

    expect(written).not.toContain("Rate limit reached");
    expect(written).not.toContain("/portfolio");
  });

  it("ignores a digest another producer wrote", () => {
    expect(readApiErrorDigest("3936653988")).toBeNull();
    expect(readApiErrorDigest("NEXT_REDIRECT")).toBeNull();
    expect(readApiErrorDigest("NEXT_HTTP_ERROR_FALLBACK;404")).toBeNull();
  });

  it("ignores a missing or malformed digest", () => {
    expect(readApiErrorDigest(undefined)).toBeNull();
    expect(readApiErrorDigest("ASOBEAST_API_ERROR")).toBeNull();
    expect(readApiErrorDigest("ASOBEAST_API_ERROR;nonsense")).toBeNull();
  });

  it("drops a wait that is not a whole number of seconds", () => {
    expect(readApiErrorDigest("ASOBEAST_API_ERROR;429;soon")).toEqual({
      statusCode: 429,
      retryAfterSeconds: null,
    });
  });
});
