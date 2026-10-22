import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { answeredDatabaseDown } from "./health-answer";

function refusal(statusCode: number): ApiError {
  return new ApiError({
    statusCode,
    error: "Error",
    message: "message",
    path: "/health",
    timestamp: "2026-10-17T00:00:00.000Z",
  });
}

function databaseDownAnswer(): ApiError {
  const answer = {
    statusCode: 503,
    error: "Service Unavailable",
    message: "The database cannot be reached. Try again in 5 seconds.",
    retryAfterSeconds: 5,
    path: "/health",
    timestamp: "2026-10-19T00:00:00.000Z",
    status: "error",
    db: "down",
    redis: "up",
    pipeline: null,
  };
  return new ApiError(answer);
}

describe("answeredDatabaseDown", () => {
  it("is true for the 503 that carries the health fields beside the envelope", () => {
    expect(answeredDatabaseDown(databaseDownAnswer())).toBe(true);
  });

  it("is true for the 503 the api gives when its database is down", () => {
    expect(answeredDatabaseDown(refusal(503))).toBe(true);
  });

  it.each([502, 504, 500, 429, 404])(
    "is false for a %i, which does not prove the api answered about its database",
    (statusCode) => {
      expect(answeredDatabaseDown(refusal(statusCode))).toBe(false);
    },
  );

  it("is false for a request that never got an answer", () => {
    expect(answeredDatabaseDown(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("is false when there is no error", () => {
    expect(answeredDatabaseDown(null)).toBe(false);
  });
});
