import type { ChartPage } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureChart, followChart, getChart, unfollowChart } from "./charts";

interface Sent {
  url: string;
  method: string | undefined;
  body: unknown;
}

function stubFetch(answer: unknown, status = 200): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({
      url: String(input),
      method: init?.method,
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return Promise.resolve(
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(answer), {
            status,
            headers: { "content-type": "application/json" },
          }),
    );
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const KEY = {
  store: "APP_STORE",
  country: "us",
  collection: "free",
  genre: "6014",
  device: "iphone",
  compare: "7d",
} as const;

describe("chart calls", () => {
  it("reads one day of a chart with every filter in the query", async () => {
    const sent = stubFetch({} as ChartPage);

    await getChart({ ...KEY, date: "2026-10-13" });

    const url = new URL(sent[0].url);
    expect(url.pathname).toMatch(/\/charts$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ...KEY,
      date: "2026-10-13",
    });
  });

  it("leaves the day out to read the newest capture", async () => {
    const sent = stubFetch({} as ChartPage);

    await getChart(KEY);

    expect(new URL(sent[0].url).searchParams.has("date")).toBe(false);
  });

  const { compare: _compare, ...CHART } = KEY;

  it("posts the chart key to capture today", async () => {
    const sent = stubFetch({} as ChartPage);

    await captureChart(CHART);

    expect(sent[0].url).toMatch(/\/charts\/capture$/);
    expect(sent[0]).toMatchObject({ method: "POST", body: CHART });
  });

  it("posts the chart key to follow and deletes a follow by id", async () => {
    const followed = stubFetch({ id: "follow-1" });
    await followChart(CHART);
    expect(followed[0].url).toMatch(/\/charts\/follows$/);
    expect(followed[0]).toMatchObject({ method: "POST", body: CHART });

    const forgotten = stubFetch(null, 204);
    await unfollowChart("follow-1");
    expect(forgotten[0].url).toMatch(/\/charts\/follows\/follow-1$/);
    expect(forgotten[0].method).toBe("DELETE");
  });
});
