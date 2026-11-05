import { afterEach, describe, expect, it, vi } from "vitest";
import { getAlertEvents } from "./alerts";
import { ApiError } from "./client";

function stubFetch(status = 200): string[] {
  const sent: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    sent.push(String(input));
    const body =
      status === 200
        ? { events: [], nextCursor: null }
        : {
            statusCode: status,
            error: "Bad Request",
            message: "type nope is not an alert event",
            path: "/alerts/events",
            timestamp: "2026-11-03T00:00:00.000Z",
          };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return sent;
}

const queryOf = (url: string) => new URL(url, "http://localhost").searchParams;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAlertEvents", () => {
  it("asks for the feed with no query when nothing is filtered", async () => {
    const sent = stubFetch();

    await getAlertEvents();
    await getAlertEvents({ type: [] });

    expect(sent).toHaveLength(2);
    for (const url of sent) {
      expect(url).toMatch(/\/alerts\/events$/);
    }
  });

  it("sends every filter it is given and joins the types", async () => {
    const sent = stubFetch();

    await getAlertEvents({
      appId: "app-1",
      type: ["rank.dropped", "chart.entered"],
      since: "2026-11-01T00:00:00.000Z",
      cursor: "c50",
      limit: 50,
    });

    expect(Object.fromEntries(queryOf(sent[0]))).toEqual({
      appId: "app-1",
      type: "rank.dropped,chart.entered",
      since: "2026-11-01T00:00:00.000Z",
      cursor: "c50",
      limit: "50",
    });
  });

  it("leaves absent values out", async () => {
    const sent = stubFetch();

    await getAlertEvents({ limit: 1 });

    expect(Object.fromEntries(queryOf(sent[0]))).toEqual({ limit: "1" });
  });

  it("propagates a refusal as an api error", async () => {
    stubFetch(400);

    await expect(
      getAlertEvents({ type: ["rank.dropped"] }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
