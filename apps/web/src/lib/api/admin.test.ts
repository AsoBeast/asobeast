import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAdminApps,
  getAdminConversion,
  getAdminDepartures,
  getAdminOverview,
  getAdminUsers,
  getCapacityReport,
  getProxyPool,
  getSupportWorkspace,
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
    [
      "the conversion over 30 days",
      () => getAdminConversion(30),
      "/admin/support/conversion?days=30",
    ],
    [
      "the conversion over 90 days",
      () => getAdminConversion(90),
      "/admin/support/conversion?days=90",
    ],
    ["the departures", getAdminDepartures, "/admin/support/departures"],
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
    [
      "one workspace's details",
      () => getSupportWorkspace("ws_ana"),
      "/admin/support/workspaces/ws_ana",
    ],
    [
      "the details of a workspace whose id needs escaping",
      () => getSupportWorkspace("ws a/b"),
      "/admin/support/workspaces/ws%20a%2Fb",
    ],
    ["the capacity report", getCapacityReport, "/admin/capacity"],
    ["the proxy pool", getProxyPool, "/admin/proxy-pool"],
  ] as const)("requests %s", async (_name, call, path) => {
    const requested = stubFetch();

    await call();

    expect(requested).toHaveLength(1);
    expect(requested[0].endsWith(path)).toBe(true);
  });
});
