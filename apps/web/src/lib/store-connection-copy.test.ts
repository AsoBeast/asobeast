import {
  PLAY_REPLIES_NEED_CONSENT,
  type StoreConnectionApp,
  type StoreConnectionItem,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  appStateLabel,
  connectionStatusLine,
  historyLine,
  STORE_CONSOLES,
  needsAdminKey,
  replyAccessLine,
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

  it("names the reason apple gave when it refused the key", () => {
    const reason =
      "Apple asks the account holder to accept the latest agreement in App Store Connect, under Business. Accept it, then verify the key again.";

    expect(
      connectionStatusLine({ ...ITEM, status: "rejected", lastError: reason }),
    ).toEqual({ tone: "warning", text: reason });
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

describe("needsAdminKey", () => {
  it("asks for an admin key while an app could not be requested", () => {
    expect(
      needsAdminKey({
        ...ITEM,
        reportAccess: "readOnly",
        apps: [{ ...APP, state: "forbidden" }],
      }),
    ).toBe(true);
  });

  it("leaves a read only key alone once every request exists", () => {
    expect(needsAdminKey({ ...ITEM, reportAccess: "readOnly" })).toBe(false);
  });

  it("leaves a rejected key to verify first", () => {
    expect(
      needsAdminKey({
        ...ITEM,
        status: "rejected",
        apps: [{ ...APP, state: "forbidden" }],
      }),
    ).toBe(false);
  });

  it("is quiet for a key without apps", () => {
    expect(needsAdminKey({ ...ITEM, apps: [] })).toBe(false);
  });

  it("never asks a play service account for an admin key", () => {
    expect(
      needsAdminKey({
        ...ITEM,
        store: "GOOGLE_PLAY",
        apps: [{ ...APP, state: "forbidden" }],
      }),
    ).toBe(false);
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

describe("google play copy", () => {
  const PLAY: StoreConnectionItem = {
    ...ITEM,
    store: "GOOGLE_PLAY",
    issuerId: "reports@focus-123.iam.gserviceaccount.com",
    keyId: "a1b2c3d4e5f6",
    bucket: "pubsite_prod_rev_01234567890987654321",
  };

  it("names the service account, key id and bucket", () => {
    expect(STORE_CONSOLES.GOOGLE_PLAY.facts(PLAY).slice(0, 3)).toEqual([
      ["Service account", "reports@focus-123.iam.gserviceaccount.com"],
      ["Key ID", "a1b2c3d4e5f6"],
      ["Bucket", "pubsite_prod_rev_01234567890987654321"],
    ]);
  });

  it("names the google account and bucket of a sign in, with no key facts", () => {
    const facts = STORE_CONSOLES.GOOGLE_PLAY.facts({
      ...PLAY,
      credential: "googleAccount",
      issuerId: "owner@example.com",
      keyId: "1098765",
    });

    expect(facts.map(([term]) => term)).toEqual([
      "Google account",
      "Bucket",
      "Connected",
    ]);
    expect(facts[0][1]).toBe("owner@example.com");
  });

  it("says google refused the connection and what to do", () => {
    expect(connectionStatusLine({ ...PLAY, status: "rejected" }).text).toBe(
      "Google refused this connection. Check its access in Play Console, verify it again, or reconnect.",
    );
  });

  it("waits for the first file and labels an app without files", () => {
    expect(
      connectionStatusLine({ ...PLAY, lastSyncedAt: null }).text,
    ).toContain("first store performance file");
    expect(appStateLabel("unmatched", "GOOGLE_PLAY")).toBe(
      "No files in this bucket",
    );
  });

  it("says whether the connection may post review replies", () => {
    expect(replyAccessLine(ITEM)).toEqual({
      tone: "muted",
      text: "Not tried yet",
    });
    expect(replyAccessLine({ ...ITEM, replyAccess: "unknown" }).text).toBe(
      "Not tried yet",
    );
    expect(replyAccessLine({ ...PLAY, replyAccess: "allowed" })).toEqual({
      tone: "muted",
      text: "Allowed",
    });
  });

  it("names the role or the consent a forbidden connection lacks", () => {
    const forbidden = (item: StoreConnectionItem) =>
      replyAccessLine({ ...item, replyAccess: "forbidden" });

    expect(forbidden(ITEM)).toMatchObject({ tone: "warning" });
    expect(forbidden(ITEM).text).toContain("Admin or Customer Support");
    expect(forbidden({ ...PLAY, credential: "key" }).text).toContain(
      "Reply to reviews",
    );
    expect(forbidden({ ...PLAY, credential: "googleAccount" }).text).toContain(
      PLAY_REPLIES_NEED_CONSENT,
    );
  });
});
