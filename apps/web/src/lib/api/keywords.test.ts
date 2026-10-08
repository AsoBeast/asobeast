import type { KeywordImportResult } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importKeywords, previewKeywordImport } from "./keywords";

const RESULT: KeywordImportResult = {
  dryRun: true,
  imported: 0,
  summary: {
    rows: 1,
    new: 1,
    resume: 0,
    tracked: 0,
    duplicate: 0,
    invalid: 0,
    overQuota: 0,
  },
  cost: { store: "APP_STORE", keywordMarkets: 1, dailyRequests: 1 },
  quota: null,
  results: [{ index: 0, keyword: "habit", country: "us", status: "new" }],
};

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
      body: JSON.parse(String(init?.body)),
    });
    return Promise.resolve(
      new Response(JSON.stringify(RESULT), {
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

const REQUEST = { rows: [{ keyword: "habit", tags: ["core"] }], country: "pl" };

describe("keyword import calls", () => {
  it("U-API-01 posts the rows and the default market to the preview route", async () => {
    const sent = stubFetch();

    const result = await previewKeywordImport("app-1", REQUEST);

    expect(result).toEqual(RESULT);
    expect(sent).toEqual([
      {
        url: expect.stringContaining("/apps/app-1/keywords/import/preview"),
        method: "POST",
        body: REQUEST,
      },
    ]);
  });

  it("U-API-02 posts the same body to the import route, never to the preview", async () => {
    const sent = stubFetch();

    await importKeywords("app-1", REQUEST);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toMatch(/\/apps\/app-1\/keywords\/import$/);
    expect(sent[0]).toMatchObject({ method: "POST", body: REQUEST });
  });
});
