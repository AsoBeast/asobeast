import { afterEach, describe, expect, it, vi } from "vitest";
import { postReviewReply, withdrawReviewReply } from "./reviews";

function stubFetch(): { url: string; method: string | undefined }[] {
  const sent: { url: string; method: string | undefined }[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), method: init?.method });
    return Promise.resolve(
      new Response(JSON.stringify({ review: {} }), {
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

describe("review reply posting calls", () => {
  it("posts and withdraws the kept reply of a review", async () => {
    const sent = stubFetch();

    await postReviewReply("app-1", "rev/1");
    await withdrawReviewReply("app-1", "rev/1");

    expect(sent).toEqual([
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/reviews\/rev%2F1\/reply\/post$/,
        ),
        method: "POST",
      },
      {
        url: expect.stringMatching(
          /\/apps\/app-1\/reviews\/rev%2F1\/reply\/post$/,
        ),
        method: "DELETE",
      },
    ]);
  });
});
