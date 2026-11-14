import { describe, expect, it } from "vitest";
import type { StoreConnectionItem } from "@asobeast/shared";
import {
  connectionMark,
  connectionSummary,
  NOTHING_CONNECTED,
} from "./connection-summary";

const item = (
  overrides: Partial<StoreConnectionItem> = {},
): StoreConnectionItem => ({
  store: "APP_STORE",
  status: "active",
  reportAccess: "admin",
  issuerId: "issuer",
  keyId: "key",
  keyFingerprint: "print",
  createdAt: "2026-10-01T10:00:00.000Z",
  verifiedAt: "2026-10-01T10:00:00.000Z",
  lastSyncedAt: "2026-10-15T05:31:00.000Z",
  lastError: null,
  apps: [
    {
      appId: "a",
      name: "A",
      state: "requested",
      firstDate: "2026-09-01",
      lastDate: "2026-10-12",
    },
    {
      appId: "b",
      name: "B",
      state: "unmatched",
      firstDate: null,
      lastDate: null,
    },
  ],
  ...overrides,
});

describe("connectionMark", () => {
  it("reads a synced connection as connected", () => {
    expect(connectionMark(item())).toEqual({ tone: "on", word: "Connected" });
  });

  it("names a refused key per store", () => {
    expect(connectionMark(item({ status: "rejected" })).word).toBe(
      "Key refused",
    );
    expect(
      connectionMark(item({ store: "GOOGLE_PLAY", status: "rejected" })).word,
    ).toBe("Connection refused");
  });

  it("asks for an Admin key when an app is forbidden", () => {
    const forbidden = item({
      apps: [{ ...item().apps[0], state: "forbidden" }],
    });
    expect(connectionMark(forbidden)).toEqual({
      tone: "warning",
      word: "Needs an Admin key",
    });
  });

  it("flags any other stored error", () => {
    expect(connectionMark(item({ lastError: "Quota" })).word).toBe(
      "Needs attention",
    );
  });

  it("waits while nothing was synced or no app has data", () => {
    expect(connectionMark(item({ lastSyncedAt: null })).tone).toBe("off");
    expect(connectionMark(item({ apps: [item().apps[1]] })).word).toBe(
      "Waiting for data",
    );
  });
});

describe("connectionSummary", () => {
  it("says nothing while store connections are off", () => {
    expect(connectionSummary({ available: false, connections: [] })).toBeNull();
  });

  it("says so when no store is connected", () => {
    expect(connectionSummary({ available: true, connections: [] })).toEqual([
      { text: NOTHING_CONNECTED },
    ]);
  });

  it("counts stores, reporting apps and the newest report day", () => {
    expect(
      connectionSummary({ available: true, connections: [item()] }),
    ).toEqual([
      { figure: "1 of 2", text: "stores connected" },
      { figure: "1 of 2", text: "apps reporting" },
      { text: "store data through", figure: "Oct 12, 2026", after: true },
    ]);
  });

  it("names a store that needs attention and leaves out what it cannot count", () => {
    expect(
      connectionSummary({
        available: true,
        connections: [item({ status: "rejected", apps: [] })],
      }),
    ).toEqual([
      { figure: "1 of 2", text: "stores connected" },
      { text: "App Store Connect: key refused", warning: true },
    ]);
  });

  it("does not count the apps of a refused connection as reporting", () => {
    expect(
      connectionSummary({
        available: true,
        connections: [
          item(),
          item({ store: "GOOGLE_PLAY", status: "rejected" }),
        ],
      }),
    ).toContainEqual({ figure: "1 of 4", text: "apps reporting" });
  });
});
