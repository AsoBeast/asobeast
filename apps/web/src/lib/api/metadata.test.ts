import { afterEach, describe, expect, it, vi } from "vitest";
import { previewListingCoverage } from "./metadata";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("previewListingCoverage", () => {
  it("posts the draft to the coverage preview", async () => {
    const sent: { url: string; method?: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({
        url: String(input),
        method: init?.method,
        body: JSON.parse(String(init?.body)),
      });
      return Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    await previewListingCoverage("app-1", {
      localization: "en-US",
      title: "Habit Tracker",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toMatch(/\/apps\/app-1\/metadata\/coverage-preview$/);
    expect(sent[0].method).toBe("POST");
    expect(sent[0].body).toEqual({
      localization: "en-US",
      title: "Habit Tracker",
    });
  });
});
