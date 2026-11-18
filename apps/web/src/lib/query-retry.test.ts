import type { ApiErrorEnvelope } from "@asobeast/shared";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  busyRetry,
  retryDelayFor,
  shouldRetry,
  tryAgainIfBusy,
  waitingOutBusyServer,
} from "./query-retry";

function apiError(statusCode: number, retryAfterSeconds?: number): ApiError {
  const envelope: ApiErrorEnvelope = {
    statusCode,
    error: "Error",
    message: "boom",
    path: "/portfolio",
    timestamp: "2026-08-25T10:30:26.118Z",
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
  return new ApiError(envelope);
}

describe("shouldRetry", () => {
  it("never spends more budget on a refusal the API already decided", () => {
    for (const statusCode of [401, 402, 403, 404, 429]) {
      expect(shouldRetry(0, apiError(statusCode))).toBe(false);
    }
  });

  it("retries a server failure up to three times", () => {
    expect(shouldRetry(0, apiError(500))).toBe(true);
    expect(shouldRetry(2, apiError(500))).toBe(true);
    expect(shouldRetry(3, apiError(500))).toBe(false);
  });

  it("retries a transport failure that carries no envelope", () => {
    expect(shouldRetry(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetry(3, new TypeError("fetch failed"))).toBe(false);
  });
});

describe("retryDelayFor", () => {
  it("waits the seconds the refusal asked for", () => {
    expect(retryDelayFor(0, apiError(503, 4))).toBe(4_000);
  });

  it("backs off exponentially when no wait was given", () => {
    expect(retryDelayFor(0, apiError(500))).toBe(1_000);
    expect(retryDelayFor(1, apiError(500))).toBe(2_000);
    expect(retryDelayFor(2, new Error("offline"))).toBe(4_000);
  });

  it("caps its own backoff at thirty seconds", () => {
    expect(retryDelayFor(20, new Error("offline"))).toBe(30_000);
  });

  it("backs off itself rather than trust a wait it cannot use", () => {
    expect(retryDelayFor(0, apiError(503, 0))).toBe(1_000);
    expect(retryDelayFor(0, apiError(503, -4))).toBe(1_000);
  });
});

describe("busyRetry", () => {
  it("tries a busy server once more", () => {
    expect(busyRetry.retry(0, apiError(503, 4))).toBe(true);
    expect(busyRetry.retry(1, apiError(503, 4))).toBe(false);
  });

  it("never retries a 503 that names no wait", () => {
    expect(busyRetry.retry(0, apiError(503))).toBe(false);
  });

  it("never retries a refusal, a store failure or a lost connection", () => {
    for (const error of [
      apiError(400),
      apiError(402),
      apiError(409),
      apiError(422),
      apiError(429, 4),
      apiError(500),
      apiError(502),
      new TypeError("fetch failed"),
    ]) {
      expect(busyRetry.retry(0, error)).toBe(false);
    }
  });

  it("waits the seconds the busy answer asked for", () => {
    expect(busyRetry.retryDelay(0, apiError(503, 4))).toBe(4_000);
  });
});

describe("waitingOutBusyServer", () => {
  it("says a mutation is waiting out a busy server only between tries", () => {
    expect(waitingOutBusyServer({ isPending: true, failureCount: 1 })).toBe(
      true,
    );
    expect(waitingOutBusyServer({ isPending: true, failureCount: 0 })).toBe(
      false,
    );
    expect(waitingOutBusyServer({ isPending: false, failureCount: 1 })).toBe(
      false,
    );
  });
});

describe("tryAgainIfBusy", () => {
  it("sends a request a busy server refused once more after its wait", async () => {
    vi.useFakeTimers();
    const request = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(503, 2))
      .mockResolvedValueOnce("added");

    const answer = tryAgainIfBusy(request);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(answer).resolves.toBe("added");
    expect(request).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("gives up with the second busy answer", async () => {
    vi.useFakeTimers();
    const second = apiError(503, 2);
    const request = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(503, 2))
      .mockRejectedValueOnce(second);

    const answer = tryAgainIfBusy(request);
    const settled = expect(answer).rejects.toBe(second);
    await vi.advanceTimersByTimeAsync(2_000);

    await settled;
    expect(request).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("never sends again what was refused for another reason", async () => {
    const refusal = apiError(429, 4);
    const request = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(refusal);

    await expect(tryAgainIfBusy(request)).rejects.toBe(refusal);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
