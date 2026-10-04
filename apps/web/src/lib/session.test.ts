import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthStatus } from "@asobeast/shared";
import { ApiError, getAuthStatus } from "@/lib/api";
import { holdSession, SessionNotKeptError } from "./session";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAuthStatus: vi.fn(),
}));

const status = vi.mocked(getAuthStatus);

const STATUS: AuthStatus = {
  billing: false,
  registrationOpen: false,
  setupRequired: false,
  authenticated: true,
};

afterEach(() => {
  status.mockReset();
  vi.restoreAllMocks();
});

describe("holdSession", () => {
  it("returns what the request established once the session is kept", async () => {
    status.mockResolvedValue(STATUS);

    await expect(holdSession(async () => "signed in")).resolves.toBe(
      "signed in",
    );
  });

  it("refuses a session the browser did not keep", async () => {
    status.mockResolvedValue({ ...STATUS, authenticated: false });

    await expect(holdSession(async () => "signed in")).rejects.toBeInstanceOf(
      SessionNotKeptError,
    );
  });

  it("checks the session only after the request that sets it has answered", async () => {
    const order: string[] = [];
    status.mockImplementation(async () => {
      order.push("status");
      return STATUS;
    });

    await holdSession(async () => {
      order.push("establish");
    });

    expect(order).toEqual(["establish", "status"]);
  });

  it("does not check a session the request failed to establish", async () => {
    const refused = new Error("wrong password");

    await expect(
      holdSession(async () => {
        throw refused;
      }),
    ).rejects.toBe(refused);
    expect(status).not.toHaveBeenCalled();
  });

  it("lets the sign in through when the check itself gets no answer", async () => {
    status.mockRejectedValue(new TypeError("fetch failed"));

    await expect(holdSession(async () => "signed in")).resolves.toBe(
      "signed in",
    );
  });

  it("lets the sign in through when the check is refused by the api", async () => {
    status.mockRejectedValue(
      new ApiError({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Internal server error",
        path: "/auth/status",
        timestamp: "2026-10-04T00:00:00.000Z",
      }),
    );

    await expect(holdSession(async () => "signed in")).resolves.toBe(
      "signed in",
    );
  });

  it("lets the sign in through when the check hangs past its deadline", async () => {
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    status.mockImplementation(
      (init) =>
        new Promise<AuthStatus>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const held = holdSession(async () => "signed in");
    await vi.waitFor(() => expect(status).toHaveBeenCalled());
    deadline.abort(new DOMException("The check timed out.", "TimeoutError"));

    await expect(held).resolves.toBe("signed in");
    expect(timeout).toHaveBeenCalledWith(5_000);
  });
});
