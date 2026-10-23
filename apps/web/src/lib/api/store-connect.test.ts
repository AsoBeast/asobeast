import type { StoreConnectionState } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completePlaySignIn,
  connectStore,
  disconnectStore,
  getStoreConnections,
  startPlaySignIn,
  syncStore,
  verifyStore,
} from "./store-connect";

interface Sent {
  url: string;
  method: string | undefined;
  body: unknown;
}

function stubFetch(answer: unknown, status = 200): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({
      url: String(input),
      method: init?.method,
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return Promise.resolve(
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(answer), {
            status,
            headers: { "content-type": "application/json" },
          }),
    );
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const pathOf = (sent: Sent) => new URL(sent.url).pathname;

describe("store connection calls", () => {
  it("reads the connections of the workspace", async () => {
    const sent = stubFetch({
      available: true,
      connections: [],
    } satisfies StoreConnectionState);

    await expect(getStoreConnections()).resolves.toEqual({
      available: true,
      connections: [],
    });
    expect(pathOf(sent[0])).toMatch(/\/store-connections$/);
    expect(sent[0].method).toBeUndefined();
  });

  it("connects a key with a put to the store it names", async () => {
    const sent = stubFetch({});
    const body = {
      store: "APP_STORE" as const,
      issuerId: "57246542-96fe-1a63-e053-0824d011072a",
      keyId: "2X9R4HXF34",
      privateKey: "-----BEGIN PRIVATE KEY-----",
    };

    await connectStore(body);

    expect(pathOf(sent[0])).toMatch(/\/store-connections\/APP_STORE$/);
    expect(sent[0].method).toBe("PUT");
    expect(sent[0].body).toEqual(body);
  });

  it("verifies and syncs with a post", async () => {
    const sent = stubFetch({ outcome: "queued" });

    await verifyStore("APP_STORE");
    await syncStore("APP_STORE");

    expect(sent.map((each) => [each.method, pathOf(each)])).toEqual([
      [
        "POST",
        expect.stringMatching(/\/store-connections\/APP_STORE\/verify$/),
      ],
      ["POST", expect.stringMatching(/\/store-connections\/APP_STORE\/sync$/)],
    ]);
  });

  it("disconnects with a delete", async () => {
    const sent = stubFetch(null, 204);

    await expect(disconnectStore("APP_STORE")).resolves.toBeUndefined();
    expect(sent[0].method).toBe("DELETE");
    expect(pathOf(sent[0])).toMatch(/\/store-connections\/APP_STORE$/);
  });

  it("starts and completes a google play sign in with posts", async () => {
    const sent = stubFetch({ url: "https://accounts.google.com/o/oauth2" });

    await startPlaySignIn({ bucket: "pubsite_prod_1" });
    await completePlaySignIn({ code: "4/code", state: "v1.state" });

    expect(sent.map((each) => [pathOf(each), each.method, each.body])).toEqual([
      [
        expect.stringMatching(/\/store-connections\/GOOGLE_PLAY\/sign-in$/),
        "POST",
        { bucket: "pubsite_prod_1" },
      ],
      [
        expect.stringMatching(
          /\/store-connections\/GOOGLE_PLAY\/sign-in\/complete$/,
        ),
        "POST",
        { code: "4/code", state: "v1.state" },
      ],
    ]);
  });
});
