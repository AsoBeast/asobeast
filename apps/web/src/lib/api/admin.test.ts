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
  reconcileSupportWorkspace,
  restoreSupportWorkspace,
  runSupportWorkspaceDaily,
  suspendSupportWorkspace,
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

describe("support actions", () => {
  function stubPost(): { url: string; init?: RequestInit }[] {
    const sent: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), init });
      return Promise.resolve(
        new Response("{}", {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    return sent;
  }

  const REQUEST = { confirm: true, reason: "Chargeback opened" } as const;

  it.each([
    ["suspends", suspendSupportWorkspace, "suspend"],
    ["restores", restoreSupportWorkspace, "restore"],
    ["starts a daily run for", runSupportWorkspaceDaily, "run-daily"],
    ["reconciles", reconcileSupportWorkspace, "reconcile"],
  ] as const)("%s a workspace with the reason", async (_name, call, action) => {
    const sent = stubPost();

    await call("ws a/b", REQUEST);

    expect(sent).toHaveLength(1);
    expect(
      sent[0].url.endsWith(`/admin/support/workspaces/ws%20a%2Fb/${action}`),
    ).toBe(true);
    expect(sent[0].init?.method).toBe("POST");
    expect(JSON.parse(String(sent[0].init?.body))).toEqual(REQUEST);
  });
});
