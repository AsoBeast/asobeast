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

describe("createClient content", () => {
  it("names what answered when the url serves html instead of the api", async () => {
    const result = await getMe((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><html></html>");
    });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("text/html"),
    );
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("/api/backend"),
    );
  });

  it.each(["Application/JSON", "APPLICATION/JSON; charset=UTF-8"])(
    "reads a json body sent as %j",
    async (contentType) => {
      const result = await getMe((_req, res) => {
        res.writeHead(200, { "content-type": contentType });
        res.end('{"id":"u1"}');
      });

      expect(result).toEqual({ ok: true, data: { id: "u1" } });
    },
  );

  it("keeps reporting a json body that does not parse", async () => {
    const result = await getMe((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{");
    });

    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("was not valid JSON"),
    );
  });
});

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const parts: Buffer[] = [];
    req.on("data", (chunk: Buffer) => parts.push(chunk));
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
  });
}

describe("createClient writes", () => {
  it("sends the method, the json body and the credential", async () => {
    const seen: Record<string, string | undefined> = {};
    api = await startFakeApi((req, res) => {
      void readBody(req).then((text) => {
        seen.method = req.method;
        seen.type = req.headers["content-type"];
        seen.authorization = req.headers.authorization;
        seen.text = text;
        res.writeHead(201, { "content-type": "application/json" });
        res.end('{"ok":true}');
      });
    });

    const result = await createClient({
      apiUrl: api.base,
      token: TOKEN,
    }).request({
      method: "POST",
      path: "/apps/app-1/keywords",
      body: { keywords: ["habit tracker"], country: "us" },
    });

    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(seen).toEqual({
      method: "POST",
      type: "application/json",
      authorization: `Bearer ${TOKEN}`,
      text: JSON.stringify({ keywords: ["habit tracker"], country: "us" }),
    });
  });

  it("sends a delete with no body and reads a 204 as success", async () => {
    const seen: Record<string, string | undefined> = {};
    api = await startFakeApi((req, res) => {
      seen.method = req.method;
      seen.type = req.headers["content-type"];
      res.writeHead(204).end();
    });

    const result = await createClient({
      apiUrl: api.base,
      token: TOKEN,
    }).request({
      method: "DELETE",
      path: "/apps/app-1/keywords/kw-1",
    });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(seen).toEqual({ method: "DELETE", type: undefined });
  });

  it("never follows a redirect on a write, so the token and body stay put", async () => {
    api = await startFakeApi((_req, res) => {
      res.writeHead(307, { location: "https://elsewhere.example/apps" }).end();
    });

    const result = await createClient({
      apiUrl: api.base,
      token: TOKEN,
    }).request({
      method: "POST",
      path: "/apps/app-1/keywords",
      body: { keywords: ["habit"] },
    });

    expect(result).toMatchObject({ ok: false, status: 307 });
    expect(api.requests).toEqual(["/apps/app-1/keywords"]);
  });

  it("reports an unreachable api as status 0", async () => {
    const result = await createClient({
      apiUrl: "http://127.0.0.1:1",
      token: TOKEN,
    }).request({
      method: "PATCH",
      path: "/actions/act-1",
      body: { status: "DONE" },
    });

    expect(result).toMatchObject({ ok: false, status: 0 });
  });
});
