import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dismissKeywordDiscoveries,
  getKeywordDiscoveries,
  refreshKeywordDiscoveries,
  setKeywordDiscoverySettings,
  trackKeywordDiscoveries,
} from "./keyword-discoveries";

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

describe("keyword discovery calls", () => {
  it("reads the whole list of one market, up to the largest page", async () => {
    const sent = stubFetch();

    await getKeywordDiscoveries("app-1", "de");
    await getKeywordDiscoveries("app-1");

    expect(sent.map(({ url }) => new URL(url, "http://web").pathname)).toEqual([
      expect.stringMatching(/\/apps\/app-1\/keyword-discoveries$/),
      expect.stringMatching(/\/apps\/app-1\/keyword-discoveries$/),
    ]);
    expect(sent[0].url).toMatch(/\?country=de&limit=500$/);
    expect(sent[1].url).toMatch(/\?limit=500$/);
    expect(sent.every(({ url }) => !url.includes("state="))).toBe(true);
    expect(sent.every(({ method }) => method === undefined)).toBe(true);
  });

  it("posts the ids or the ranked market to track", async () => {
    const sent = stubFetch();

    await trackKeywordDiscoveries("app-1", { keywordIds: ["kw-1", "kw-2"] });
    await trackKeywordDiscoveries("app-1", { allRanked: true, country: "us" });

    expect(sent).toEqual([
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/keyword-discoveries\/track$/,
        ) as string,
        method: "POST",
        body: { keywordIds: ["kw-1", "kw-2"] },
      },
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/keyword-discoveries\/track$/,
        ) as string,
        method: "POST",
        body: { allRanked: true, country: "us" },
      },
    ]);
  });

  it("posts the ids to dismiss", async () => {
    const sent = stubFetch();

    await dismissKeywordDiscoveries("app-1", ["kw-1"]);

    expect(sent).toEqual([
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/keyword-discoveries\/dismiss$/,
        ) as string,
        method: "POST",
        body: { keywordIds: ["kw-1"] },
      },
    ]);
  });

  it("posts an empty refresh", async () => {
    const sent = stubFetch();

    await refreshKeywordDiscoveries("app-1");

    expect(sent).toEqual([
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/keyword-discoveries\/refresh$/,
        ) as string,
        method: "POST",
        body: undefined,
      },
    ]);
  });

  it("patches the auto track setting", async () => {
    const sent = stubFetch();

    await setKeywordDiscoverySettings("app-1", true);

    expect(sent).toEqual([
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/keyword-discoveries\/settings$/,
        ) as string,
        method: "PATCH",
        body: { autoTrackRanked: true },
      },
    ]);
  });
});
