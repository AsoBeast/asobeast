import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@asobeast/shared";
import { getAuthMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api";
import {
  ENTRY_STEP_WAIT_MS,
  viewerAdminAccess,
  viewerIsOperator,
  viewerWhenAnswered,
} from "./viewer";

vi.mock("@/lib/api/auth", () => ({ getAuthMe: vi.fn() }));

const me = vi.mocked(getAuthMe);

const USER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: null,
  role: "owner",
  plan: "indie",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: true,
  platformOperator: true,
};

afterEach(() => me.mockReset());

describe("viewerIsOperator", () => {
  it("is true for the platform operator", async () => {
    me.mockResolvedValue(USER);
    await expect(viewerIsOperator()).resolves.toBe(true);
  });

  it("is false for a workspace owner who is not the operator", async () => {
    me.mockResolvedValue({ ...USER, platformOperator: false });
    await expect(viewerIsOperator()).resolves.toBe(false);
  });

  it("is false when the api refuses the session", async () => {
    me.mockRejectedValue(
      new ApiError({
        statusCode: 401,
        error: "Unauthorized",
        message: "Sign in",
        path: "/auth/me",
        timestamp: "2026-10-03T00:00:00.000Z",
      }),
    );
    await expect(viewerIsOperator()).resolves.toBe(false);
  });

  it("rethrows an api failure so the page shows its error state", async () => {
    me.mockRejectedValue(
      new ApiError({
        statusCode: 503,
        error: "Service Unavailable",
        message: "Try again shortly",
        path: "/auth/me",
        timestamp: "2026-10-03T00:00:00.000Z",
      }),
    );
    await expect(viewerIsOperator()).rejects.toThrow("Try again shortly");
  });

  it("rethrows anything that is not an api answer", async () => {
    me.mockRejectedValue(new TypeError("fetch failed"));
    await expect(viewerIsOperator()).rejects.toThrow("fetch failed");
  });
});

describe("viewerAdminAccess", () => {
  it("is granted to an operator with a plan", async () => {
    me.mockResolvedValue(USER);
    await expect(viewerAdminAccess()).resolves.toBe("granted");
  });

  it("needs a plan for an operator whose workspace has none", async () => {
    me.mockResolvedValue({ ...USER, plan: "free", entitled: false });
    await expect(viewerAdminAccess()).resolves.toBe("needs-plan");
  });

  it("is denied to a workspace owner who is not the operator", async () => {
    me.mockResolvedValue({ ...USER, platformOperator: false });
    await expect(viewerAdminAccess()).resolves.toBe("denied");
  });

  it("is denied when the api refuses the session", async () => {
    me.mockRejectedValue(
      new ApiError({
        statusCode: 401,
        error: "Unauthorized",
        message: "Sign in",
        path: "/auth/me",
        timestamp: "2026-10-04T00:00:00.000Z",
      }),
    );
    await expect(viewerAdminAccess()).resolves.toBe("denied");
  });

  it("rethrows anything that is not an api answer", async () => {
    me.mockRejectedValue(new TypeError("fetch failed"));
    await expect(viewerAdminAccess()).rejects.toThrow("fetch failed");
  });
});

describe("viewerWhenAnswered", () => {
  afterEach(() => vi.useRealTimers());

  it("is the signed in account when the api answers", async () => {
    me.mockResolvedValue(USER);
    await expect(viewerWhenAnswered()).resolves.toEqual(USER);
  });

  it("is nobody when the api answers with a failure", async () => {
    me.mockRejectedValue(
      new ApiError({
        statusCode: 503,
        error: "Service Unavailable",
        message: "Try again shortly",
        path: "/auth/me",
        timestamp: "2026-11-03T00:00:00.000Z",
      }),
    );
    await expect(viewerWhenAnswered()).resolves.toBeNull();
  });

  it("is nobody when the api cannot be reached", async () => {
    me.mockRejectedValue(new TypeError("fetch failed"));
    await expect(viewerWhenAnswered()).resolves.toBeNull();
  });

  it("stops waiting for an api that does not answer", async () => {
    vi.useFakeTimers();
    me.mockReturnValue(new Promise<AuthUser>(() => {}));

    const read = viewerWhenAnswered();
    await vi.advanceTimersByTimeAsync(ENTRY_STEP_WAIT_MS);

    await expect(read).resolves.toBeNull();
  });
});
