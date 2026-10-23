import { PLAY_REPLIES_NEED_CONSENT } from "@asobeast/shared";
import type {
  ReviewReplyItem,
  StoreConnectionItem,
  StoreConnectionState,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  discardNotice,
  markLabel,
  needsPosting,
  postActionLabel,
  postedToast,
  postRules,
  storeReplyAccess,
} from "./store-reply-access";

const ISO = "2026-10-01T00:00:00.000Z";

const CONNECTION: StoreConnectionItem = {
  store: "APP_STORE",
  status: "active",
  reportAccess: "admin",
  issuerId: "issuer",
  keyId: "KEY",
  keyFingerprint: "fingerprint",
  createdAt: ISO,
  verifiedAt: ISO,
  lastSyncedAt: null,
  lastError: null,
  apps: [],
};

const stateWith = (
  ...connections: StoreConnectionItem[]
): StoreConnectionState => ({ available: true, connections });

const POST = {
  postedAt: ISO,
  postedText: "Thanks",
  state: "pending" as const,
  storeResponseId: "response-1",
  postedBy: null,
};

const REPLY: ReviewReplyItem = {
  text: "Thanks",
  tone: null,
  model: null,
  generatedAt: null,
  updatedAt: ISO,
  repliedAt: ISO,
  post: POST,
};

describe("storeReplyAccess", () => {
  it("is off while the connections are unknown or the instance has none", () => {
    expect(storeReplyAccess(undefined, "APP_STORE").kind).toBe("off");
    expect(
      storeReplyAccess({ available: false, connections: [] }, "APP_STORE").kind,
    ).toBe("off");
  });

  it("asks to connect the store a review belongs to", () => {
    expect(storeReplyAccess(stateWith(CONNECTION), "GOOGLE_PLAY")).toEqual({
      kind: "none",
      note: "Connect Google Play Console in Settings to post replies from here.",
    });
  });

  it("names a rejected key and a key without the reply role", () => {
    expect(
      storeReplyAccess(
        stateWith({ ...CONNECTION, status: "rejected" }),
        "APP_STORE",
      ).kind,
    ).toBe("rejected");
    const forbidden = storeReplyAccess(
      stateWith({ ...CONNECTION, replyAccess: "forbidden" }),
      "APP_STORE",
    );
    expect(forbidden.kind).toBe("forbidden");
    expect(forbidden.note).toContain("Admin or Customer Support");
    expect(
      storeReplyAccess(
        stateWith({
          ...CONNECTION,
          store: "GOOGLE_PLAY",
          credential: "googleAccount",
          replyAccess: "forbidden",
        }),
        "GOOGLE_PLAY",
      ).note,
    ).toContain(PLAY_REPLIES_NEED_CONSENT);
  });

  it("is ready for a usable connection whose access is unknown or allowed", () => {
    expect(storeReplyAccess(stateWith(CONNECTION), "APP_STORE")).toEqual({
      kind: "ready",
      note: "Posting sends this text to App Store Connect with the key connected in Settings.",
    });
    expect(
      storeReplyAccess(
        stateWith({ ...CONNECTION, replyAccess: "allowed" }),
        "APP_STORE",
      ).kind,
    ).toBe("ready");
  });
});

describe("post copy", () => {
  it("labels a first post and an update", () => {
    expect(postActionLabel("APP_STORE", null)).toBe("Post to App Store");
    expect(postActionLabel("GOOGLE_PLAY", { text: "x", post: null })).toBe(
      "Post to Google Play",
    );
    expect(postActionLabel("APP_STORE", REPLY)).toBe("Update on App Store");
  });

  it("offers a post only until the posted text is on the store", () => {
    expect(needsPosting(null, "Thanks")).toBe(true);
    expect(needsPosting(REPLY, "Thanks")).toBe(false);
    expect(needsPosting(REPLY, "Thanks again")).toBe(true);
  });

  it("states the rules, with apple's publication delay for the app store only", () => {
    expect(postRules("GOOGLE_PLAY")).toHaveLength(3);
    expect(postRules("APP_STORE")).toHaveLength(4);
    expect(postRules("APP_STORE").at(-1)).toBe(
      "Apple shows it within 24 hours.",
    );
  });

  it("toasts what each store does with a post", () => {
    expect(postedToast("APP_STORE", POST)).toBe(
      "Posted to App Store Connect. Apple publishes it within 24 hours.",
    );
    expect(postedToast("APP_STORE", { ...POST, state: "published" })).toBe(
      "Posted to App Store Connect.",
    );
    expect(postedToast("GOOGLE_PLAY", POST)).toBe("Posted on Google Play.");
  });

  it("says what stays on the store when a reply is discarded", () => {
    expect(discardNotice("APP_STORE", REPLY)).toBe(
      "The reply posted to App Store Connect stays there unless you withdraw it.",
    );
    expect(discardNotice("GOOGLE_PLAY", REPLY)).toBe(
      "The reply posted on Google Play stays there.",
    );
    expect(discardNotice("GOOGLE_PLAY", null)).toBe(
      "A reply already posted in Play Console stays there.",
    );
  });

  it("labels the replied mark", () => {
    expect(markLabel(true, true)).toBe("Undo");
    expect(markLabel(false, true)).toBe("Mark as replied without posting");
    expect(markLabel(false, false)).toBe("Mark as replied");
  });
});
