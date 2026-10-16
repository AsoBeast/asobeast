import type { StoreConnectionApp, StoreConnectionItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  appStateLabel,
  connectionStatusLine,
  historyLine,
} from "./store-connection-copy";

const APP: StoreConnectionApp = {
  appId: "app-1",
  name: "Focus",
  state: "requested",
  firstDate: "2024-01-01",
  lastDate: "2026-10-12",
};

const ITEM: StoreConnectionItem = {
  store: "APP_STORE",
  status: "active",
  reportAccess: "admin",
  issuerId: "57246542-96fe-1a63-e053-0824d011072a",
  keyId: "2X9R4HXF34",
  keyFingerprint: "0123456789abcdef",
  createdAt: "2026-10-01T10:00:00.000Z",
  verifiedAt: "2026-10-01T10:00:00.000Z",
  lastSyncedAt: "2026-10-15T05:31:00.000Z",
  lastError: null,
  apps: [APP],
};

describe("connectionStatusLine", () => {
  it("warns when the store refused the key", () => {
    expect(connectionStatusLine({ ...ITEM, status: "rejected" })).toEqual({
      tone: "warning",
      text: "App Store Connect refused this key. Verify it again, or connect a new key.",
    });
  });

  it("repeats the reason a read only key cannot request reports", () => {
    const reason =
      "This key can download reports but not request them. Connect an Admin key once; a Sales and Reports key can take over afterwards.";

    expect(
      connectionStatusLine({
        ...ITEM,
        reportAccess: "readOnly",
        lastError: reason,
      }),
    ).toEqual({ tone: "warning", text: reason });
  });

  it("says it waits for the first report while no day is stored", () => {
    expect(
      connectionStatusLine({
        ...ITEM,
        apps: [{ ...APP, firstDate: null, lastDate: null }],
      }),
    ).toEqual({
      tone: "muted",
      text: "Waiting for Apple's first report, usually within two days of connecting.",
    });
  });

  it("names the last sync once data arrived", () => {
    expect(connectionStatusLine(ITEM)).toEqual({
      tone: "muted",
      text: "Last synced Oct 15, 2026, 5:31 AM UTC",
    });
  });
});

describe("appStateLabel", () => {
  it.each([
    ["requested", "Reporting"],
    ["unmatched", "Not in this team"],
    ["forbidden", "Needs an Admin key"],
    ["stopped", "Stopped by Apple, verify to request again"],
    [null, "Waiting"],
  ] as const)("labels %s as %s", (state, label) => {
    expect(appStateLabel(state)).toBe(label);
  });
});

describe("historyLine", () => {
  it("names the first and last stored day", () => {
    expect(historyLine(APP)).toBe("Data from Jan 1, 2024 to Oct 12, 2026");
  });

  it("says when nothing is stored yet", () => {
    expect(historyLine({ ...APP, firstDate: null, lastDate: null })).toBe(
      "No data yet",
    );
  });
});
