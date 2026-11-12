import { describe, expect, it } from "vitest";
import { sheetHistory } from "./sheet-history";

const flushed = () => new Promise((resolve) => setTimeout(resolve, 0));

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("sheetHistory", () => {
  it("clears a sheet the address opened", () => {
    expect(sheetHistory().closing()).toBe("clear");
  });

  it("clears while the pushed entry is still queued", () => {
    const history = sheetHistory();
    history.opened(new Promise(() => undefined));

    expect(history.closing()).toBe("clear");
  });

  it("goes back once the pushed entry is in the history", async () => {
    const history = sheetHistory();
    history.opened(Promise.resolve());
    await flushed();

    expect(history.closing()).toBe("back");
    expect(history.closing()).toBe("clear");
  });

  it("forgets the entry when the address loses the keyword", async () => {
    const history = sheetHistory();
    history.opened(Promise.resolve());
    await flushed();
    history.cleared();

    expect(history.closing()).toBe("clear");
  });

  it("waits for the latest opening after a quick reopen", async () => {
    const history = sheetHistory();
    const first = deferred();
    history.opened(first.promise);
    history.closing();
    history.opened(new Promise(() => undefined));
    first.resolve();
    await flushed();

    expect(history.closing()).toBe("clear");
  });

  it("does not go back after a close that beat the push", async () => {
    const history = sheetHistory();
    const pushed = deferred();
    history.opened(pushed.promise);
    history.closing();
    pushed.resolve();
    await flushed();

    expect(history.closing()).toBe("clear");
  });
});
