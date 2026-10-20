import { describe, expect, it, vi } from "vitest";
import {
  keyedFlight,
  keyedSingleFlight,
  sharedFlight,
  singleFlight,
} from "./single-flight";

function deferredRun() {
  const settle: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
  const run = vi.fn<(variables: string) => Promise<void>>(
    () =>
      new Promise<void>((resolve, reject) => {
        settle.push({ resolve, reject });
      }),
  );
  return { run, settle };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("singleFlight", () => {
  it("sends one request for two calls before the first settles", () => {
    const { run } = deferredRun();
    const once = singleFlight(run);

    once("first");
    once("second");

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toBe("first");
  });

  it("sends again once the request has settled, whoever still watches it", async () => {
    const { run, settle } = deferredRun();
    const once = singleFlight(run);

    once("first");
    settle[0].resolve();
    await flush();
    once("retry");

    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1][0]).toBe("retry");
  });

  it("lets a failed submission be retried without an unhandled rejection", async () => {
    const { run, settle } = deferredRun();
    const once = singleFlight(run);

    once("first");
    settle[0].reject(new Error("offline"));
    await flush();
    once("retry");

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps separate guards for separate submissions", () => {
    const { run } = deferredRun();

    singleFlight(run)("one");
    singleFlight(run)("two");

    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("sharedFlight", () => {
  it("hands a second call the promise already in flight", async () => {
    const { run, settle } = deferredRun();
    const once = sharedFlight(run);

    const first = once("first");
    const second = once("second");
    settle[0].resolve();

    expect(second).toBe(first);
    await expect(second).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs again after the promise settles, including after a failure", async () => {
    const run = vi
      .fn<(variables: void) => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("deleted");
    const once = sharedFlight(run);

    await expect(once()).rejects.toThrow("offline");
    await expect(once()).resolves.toBe("deleted");
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("keyedFlight", () => {
  it("shares a flight for the same key and runs another key at once", () => {
    const { run } = deferredRun();
    const save = keyedFlight(run, (text: string) => text);

    const first = save("draft");
    const repeat = save("draft");
    const edited = save("draft, edited");

    expect(repeat).toBe(first);
    expect(edited).not.toBe(first);
    expect(run.mock.calls).toEqual([["draft"], ["draft, edited"]]);
  });

  it("runs a key again once its flight settled", async () => {
    const { run, settle } = deferredRun();
    const save = keyedFlight(run, (text: string) => text);

    const first = save("draft");
    settle[0].resolve();
    await first;
    void save("draft");

    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("keyedSingleFlight", () => {
  it("sends one request per key and lets another key through at once", () => {
    const { run } = deferredRun();
    const track = keyedSingleFlight(run, (text: string) => text);

    track("sleep");
    track("sleep");
    track("focus");

    expect(run.mock.calls).toEqual([["sleep"], ["focus"]]);
  });

  it("sends a key again once its request settled, failure included", async () => {
    const { run, settle } = deferredRun();
    const track = keyedSingleFlight(run, (text: string) => text);

    track("sleep");
    settle[0].reject(new Error("offline"));
    await flush();
    track("sleep");

    expect(run).toHaveBeenCalledTimes(2);
  });
});
