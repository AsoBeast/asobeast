import type {
  AppLocalizationsResult,
  LocalizedKeywordFieldResult,
} from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppLocalizations,
  previewLocalizedKeywordField,
  saveLocalizedKeywordField,
} from "./localizations";

interface Sent {
  url: string;
  method: string | undefined;
  body: unknown;
}

function stubFetch(answer: unknown): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({
      url: String(input),
      method: init?.method,
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return Promise.resolve(
      new Response(JSON.stringify(answer), {
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

const LIST: AppLocalizationsResult = {
  home: "us",
  markets: ["us"],
  localizations: [],
};

describe("localization calls", () => {
  it("W-QRY-03 reads the localizations of one app", async () => {
    const sent = stubFetch(LIST);

    await expect(getAppLocalizations("app-1")).resolves.toEqual(LIST);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toMatch(/\/apps\/app-1\/localizations$/);
    expect(sent[0].method).toBeUndefined();
  });

  it("W-QRY-04 puts the text and the markets to the keyword field of one localization", async () => {
    const answer = {
      duplicatesRemoved: 0,
      trackedIn: ["us"],
    } as unknown as LocalizedKeywordFieldResult;
    const sent = stubFetch(answer);

    await saveLocalizedKeywordField("app-1", "es-MX", {
      text: "temporizador",
      trackIn: ["us", "mx"],
    });

    expect(sent[0].url).toMatch(/\/apps\/app-1\/keyword-fields\/es-MX$/);
    expect(sent[0]).toMatchObject({
      method: "PUT",
      body: { text: "temporizador", trackIn: ["us", "mx"] },
    });
  });

  it("W-SAV-11 posts only the text to the preview of one localization", async () => {
    const sent = stubFetch({ markets: [] });

    await previewLocalizedKeywordField("app-1", "es-MX", {
      text: "temporizador",
    });

    expect(sent[0].url).toMatch(
      /\/apps\/app-1\/keyword-fields\/es-MX\/preview$/,
    );
    expect(sent[0]).toMatchObject({
      method: "POST",
      body: { text: "temporizador" },
    });
  });
});
