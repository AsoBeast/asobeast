import { afterEach, describe, expect, it, vi } from "vitest";

const REFUSAL = {
  statusCode: 401,
  error: "Unauthorized",
  message: "Not authenticated",
  path: "/apps",
  timestamp: "2026-10-17T00:00:00.000Z",
};

async function apiFetchRefusedWith(
  status: number,
  requestedPath: string | null,
) {
  vi.resetModules();
  const redirect = vi.fn((target: string): never => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  });
  vi.doMock("next/navigation", () => ({ redirect }));
  vi.doMock("next/headers", () => ({
    headers: async () =>
      new Headers(
        requestedPath === null
          ? {}
          : { "x-asobeast-requested-path": requestedPath },
      ),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ ...REFUSAL, statusCode: status }, { status }),
    ),
  );
  const { ApiError, apiFetch } = await import("./client");
  return { ApiError, apiFetch, redirect };
}

describe("apiFetch refused on the server", () => {
  afterEach(() => {
    vi.doUnmock("next/navigation");
    vi.doUnmock("next/headers");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a render the api refused with 401 to sign in with the requested page", async () => {
    const { apiFetch, redirect } = await apiFetchRefusedWith(
      401,
      "/charts?store=APP_STORE&genre=6011",
    );

    await expect(apiFetch("/apps")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fcharts%3Fstore%3DAPP_STORE%26genre%3D6011",
    );
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("sends the identity check of a refused render the same way", async () => {
    const { apiFetch } = await apiFetchRefusedWith(401, "/admin");

    await expect(apiFetch("/auth/me")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fadmin",
    );
  });

  it("keeps the api error when the proxy recorded no requested page", async () => {
    const { ApiError, apiFetch, redirect } = await apiFetchRefusedWith(
      401,
      null,
    );

    await expect(apiFetch("/apps")).rejects.toBeInstanceOf(ApiError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps the api error on a public route", async () => {
    const { ApiError, apiFetch, redirect } = await apiFetchRefusedWith(
      401,
      "/login",
    );

    await expect(apiFetch("/apps")).rejects.toBeInstanceOf(ApiError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([402, 403, 404, 500])(
    "keeps a %i as the api error",
    async (status) => {
      const { ApiError, apiFetch, redirect } = await apiFetchRefusedWith(
        status,
        "/charts",
      );

      await expect(apiFetch("/apps")).rejects.toBeInstanceOf(ApiError);
      expect(redirect).not.toHaveBeenCalled();
    },
  );
});
