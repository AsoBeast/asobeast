import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "./client.js";

const TOKEN = `asob_${"a".repeat(48)}`;

interface FakeApi {
  base: string;
  requests: string[];
  close: () => Promise<void>;
}

let api: FakeApi | undefined;

afterEach(async () => {
  await api?.close();
  api = undefined;
});

function startFakeApi(
  respond: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<FakeApi> {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(req.url ?? "/");
    respond(req, res);
  });
  return new Promise<FakeApi>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        base: `http://127.0.0.1:${port}`,
        requests,
        close: () =>
          new Promise<void>((closed) => server.close(() => closed())),
      });
    });
  });
}

async function getMe(respond: Parameters<typeof startFakeApi>[0]) {
  api = await startFakeApi(respond);
  return createClient({ apiUrl: api.base, token: TOKEN }).get("/auth/me");
}

describe("createClient redirects", () => {
  it("names the api address when the url is the web app", async () => {
    const result = await getMe((_req, res) => {
      res.writeHead(307, { location: "/login?next=%2Fauth%2Fme" }).end();
    });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining(`web app`),
    );
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining(`${api?.base}/api/backend`),
    );
    expect(api?.requests).toEqual(["/auth/me"]);
  });

  it("never follows a redirect to another address", async () => {
    const result = await getMe((_req, res) => {
      res
        .writeHead(301, { location: "https://elsewhere.example/auth/me" })
        .end();
    });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("https://elsewhere.example/auth/me"),
    );
    expect(api?.requests).toEqual(["/auth/me"]);
  });
});
