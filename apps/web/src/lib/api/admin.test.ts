import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAdminApps,
  getAdminOverview,
  getAdminUsers,
  getCapacityReport,
  getProxyPool,
  getSupportWorkspaces,
} from "./admin";

function stubFetch(): string[] {
  const requested: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    requested.push(String(input));
    return Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return requested;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin transport", () => {
  it.each([
    ["the overview", getAdminOverview, "/admin/support/overview"],
    ["every user", () => getAdminUsers(), "/admin/support/users"],
    [
      "one workspace's users",
      () => getAdminUsers("ws_1"),
      "/admin/support/users?workspaceId=ws_1",
    ],
    ["every app", () => getAdminApps(), "/admin/support/apps"],
    [
      "one workspace's apps",
      () => getAdminApps("ws_1"),
      "/admin/support/apps?workspaceId=ws_1",
    ],
    ["every workspace", getSupportWorkspaces, "/admin/support/workspaces"],
    ["the capacity report", getCapacityReport, "/admin/capacity"],
    ["the proxy pool", getProxyPool, "/admin/proxy-pool"],
  ] as const)("requests %s", async (_name, call, path) => {
    const requested = stubFetch();

    await call();

    expect(requested).toHaveLength(1);
    expect(requested[0].endsWith(path)).toBe(true);
  });
});
