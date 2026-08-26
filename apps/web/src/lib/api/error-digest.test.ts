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

function planRefusal(): ApiErrorEnvelope {
  return {
    ...envelope(429, 4),
    rateLimit: {
      window: "minute",
      rateClass: "read",
      plan: "trial",
      limit: 300,
      resetSeconds: 4,
      upgradeTo: "indie",
    },
  };
}

describe("api error digest", () => {
  it("carries the status and the wait across the boundary", () => {
    expect(readApiErrorDigest(writeApiErrorDigest(envelope(429, 4)))).toEqual({
      statusCode: 429,
      retryAfterSeconds: 4,
      planRefusal: false,
    });
  });

  it("carries a status the API gave no wait for", () => {
    expect(readApiErrorDigest(writeApiErrorDigest(envelope(404)))).toEqual({
      statusCode: 404,
      retryAfterSeconds: null,
      planRefusal: false,
    });
  });

  it("marks the refusals the plan budget caused", () => {
    expect(readApiErrorDigest(writeApiErrorDigest(planRefusal()))).toEqual({
      statusCode: 429,
      retryAfterSeconds: 4,
      planRefusal: true,
    });
  });

  it("never carries the message, the path or the plan", () => {
    const written = writeApiErrorDigest(planRefusal());

    expect(written).not.toContain("Rate limit reached");
    expect(written).not.toContain("/portfolio");
    expect(written).not.toContain("trial");
    expect(written).not.toContain("indie");
  });

  it("tells two failures of the same shape apart", () => {
    expect(writeApiErrorDigest(envelope(429, 4))).not.toBe(
      writeApiErrorDigest(envelope(429, 4)),
    );
    expect(readApiErrorDigest(writeApiErrorDigest(envelope(429, 4)))).toEqual(
      readApiErrorDigest(writeApiErrorDigest(envelope(429, 4))),
    );
  });

  it("ignores a digest another producer wrote", () => {
    expect(readApiErrorDigest("3936653988")).toBeNull();
    expect(readApiErrorDigest("3936653988@E394")).toBeNull();
    expect(readApiErrorDigest("NEXT_REDIRECT")).toBeNull();
    expect(readApiErrorDigest("NEXT_HTTP_ERROR_FALLBACK;404")).toBeNull();
  });

  it("ignores a missing or malformed digest", () => {
    expect(readApiErrorDigest(undefined)).toBeNull();
    expect(readApiErrorDigest("ASOBEAST_API_ERROR")).toBeNull();
    expect(readApiErrorDigest("ASOBEAST_API_ERROR;nonsense")).toBeNull();
    expect(readApiErrorDigest("ASOBEAST_API_ERROR;;")).toBeNull();
  });

  it("drops a wait it cannot count on", () => {
    for (const wait of ["soon", "-4", "0", "1.5"]) {
      expect(readApiErrorDigest(`ASOBEAST_API_ERROR;429;${wait}`)).toEqual({
        statusCode: 429,
        retryAfterSeconds: null,
        planRefusal: false,
      });
    }
  });

  it("refuses a status no HTTP response can carry", () => {
    for (const status of ["0", "-429", "", "4e2", " 429 ", "999"]) {
      expect(readApiErrorDigest(`ASOBEAST_API_ERROR;${status};4`)).toBeNull();
    }
  });
});
