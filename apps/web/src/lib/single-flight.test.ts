import { describe, expect, it, vi } from "vitest";
import { sharedFlight, singleFlight } from "./single-flight";

function recordingMutate() {
  const settle: Array<() => void> = [];
  const mutate = vi.fn(
    (_variables: string, options: { onSettled: () => void }) => {
      settle.push(options.onSettled);
    },
  );
  return { mutate, settle };
}

describe("singleFlight", () => {
  it("sends one request for two calls before the first settles", () => {
    const { mutate } = recordingMutate();
    const once = singleFlight(mutate);

    once("first");
    once("second");

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toBe("first");
  });

  it("sends again once the first call has settled", () => {
    const { mutate, settle } = recordingMutate();
    const once = singleFlight(mutate);

    once("first");
    settle[0]();
    once("retry");

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1][0]).toBe("retry");
  });

  it("lets a failed submission be retried, since settling follows an error too", () => {
    const failing = vi.fn(
      (_variables: string, options: { onSettled: () => void }) => {
        options.onSettled();
      },
    );
    const once = singleFlight(failing);

    once("first");
    once("retry");

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("keeps separate guards for separate submissions", () => {
    const { mutate } = recordingMutate();

    singleFlight(mutate)("one");
    singleFlight(mutate)("two");

    expect(mutate).toHaveBeenCalledTimes(2);
  });
});

describe("sharedFlight", () => {
  it("hands a second call the promise already in flight", async () => {
    let resolve: (value: string) => void = () => undefined;
    const run = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const once = sharedFlight(run);

    const first = once();
    const second = once();
    resolve("deleted");

    expect(second).toBe(first);
    await expect(second).resolves.toBe("deleted");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs again after the promise settles, including after a failure", async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("deleted");
    const once = sharedFlight(run);

    await expect(once()).rejects.toThrow("offline");
    await expect(once()).resolves.toBe("deleted");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
