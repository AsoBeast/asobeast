import type { ApiErrorEnvelope } from "@asobeast/shared";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as docs from "@/app/docs/[[...path]]/route";
import * as docsJson from "@/app/docs-json/route";
import * as docsYaml from "@/app/docs-yaml/route";
import * as metrics from "@/app/metrics/route";
import * as queues from "@/app/admin/queues/[[...path]]/route";

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) => Response | Promise<Response>;

const ANSWERED_LOCALLY = ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const FORWARDED_BY_QUEUES = ["POST", "PUT", "PATCH", "DELETE"] as const;

const READ_ONLY_SURFACES: [string, Record<string, unknown>][] = [
  ["/docs", docs],
  ["/docs/swagger-ui.css", docs],
  ["/docs-json", docsJson],
  ["/docs-yaml", docsYaml],
  ["/metrics", metrics],
];

function call(module: Record<string, unknown>, method: string, path: string) {
  const handler = module[method] as Handler;
  return handler(
    new NextRequest(`http://web.local${path}?token=asob_x`, { method }),
    { params: Promise.resolve({}) },
  );
}

describe("the read only admin surfaces", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe.each(READ_ONLY_SURFACES)("%s", (path, module) => {
    it.each(ANSWERED_LOCALLY)(
      "answers %s with the not found envelope",
      async (method) => {
        const response = await call(module, method, path);

        expect(response.status).toBe(404);
        expect(response.headers.get("allow")).toBeNull();
        const envelope = (await response.json()) as ApiErrorEnvelope;
        expect(envelope.message).toBe(`Cannot ${method} ${path}`);
        expect(envelope.path).toBe(path);
        expect(fetch).not.toHaveBeenCalled();
      },
    );

    it("still forwards GET to the api", async () => {
      await call(module, "GET", path);

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe("the queue dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(FORWARDED_BY_QUEUES)(
    "forwards %s to the api gate",
    async (method) => {
      await call(queues, method, "/admin/queues/api/queues/pause");

      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("answers OPTIONS locally with not found", async () => {
    const response = await call(queues, "OPTIONS", "/admin/queues");

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});
