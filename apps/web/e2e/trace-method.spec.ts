import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { expect, test } from "./session.mts";

const PROBE = "trace-probe-7f3a91";
const ROUTES = [
  "/",
  "/login",
  "/api/health",
  "/api/backend/health",
  "/docs-json",
  "/admin/queues",
];

interface TraceAnswer {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

function trace(baseURL: string, path: string): Promise<TraceAnswer> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      new URL(path, baseURL),
      { method: "TRACE", headers: { "x-probe": PROBE } },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () =>
          resolve({
            status: incoming.statusCode ?? 0,
            headers: incoming.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}

test.describe("the TRACE method", () => {
  for (const route of ROUTES) {
    test(`${route} answers without echoing the request`, async ({
      baseURL,
    }) => {
      const answer = await trace(baseURL!, route);

      expect(answer.headers["content-type"] ?? "").not.toContain(
        "message/http",
      );
      expect(answer.body).not.toContain(PROBE);
      expect(JSON.stringify(answer.headers)).not.toContain(PROBE);
    });
  }

  test("the server keeps answering after a TRACE", async ({
    baseURL,
    request,
  }) => {
    await trace(baseURL!, "/");
    const health = await request.get("/api/health");

    expect(health.status()).toBe(200);
  });
});
