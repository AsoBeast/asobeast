import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppSetup, updateAppSetup } from "./setup";

interface Sent {
  url: string;
  method: string | undefined;
  body: unknown;
}

function stubFetch(): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({
      url: String(input),
      method: init?.method,
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("setup transport", () => {
  it("reads the setup of an app", async () => {
    const sent = stubFetch();

    await getAppSetup("app-1");

    expect(sent).toEqual([
      {
        url: expect.stringMatching(/\/apps\/app-1\/setup$/),
        method: undefined,
        body: undefined,
      },
    ]);
  });

  it("patches only the fields it is given", async () => {
    const sent = stubFetch();

    await updateAppSetup("app-1", { skipped: ["keywords"] });

    expect(sent).toEqual([
      {
        url: expect.stringMatching(/\/apps\/app-1\/setup$/),
        method: "PATCH",
        body: { skipped: ["keywords"] },
      },
    ]);
  });
});
