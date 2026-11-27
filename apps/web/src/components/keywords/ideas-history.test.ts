import { describe, expect, it } from "vitest";
import { createIdeasHistory } from "./ideas-history";

const flushed = () => new Promise((resolve) => setTimeout(resolve, 0));

const search = (query: string) => new URLSearchParams(query);

const landed = (query: string) => Promise.resolve(search(query));

describe("createIdeasHistory", () => {
  it("clears Ideas the address opened", () => {
    expect(createIdeasHistory().closing(search("ideas=timer"))).toBe("clear");
  });

  it("clears while the pushed entry is still queued", () => {
    const history = createIdeasHistory();
    history.opened(new Promise(() => undefined));

    expect(history.closing(search("ideas=timer"))).toBe("clear");
  });

  it("goes back once from the entry it pushed", async () => {
    const history = createIdeasHistory();
    history.opened(landed("ideas=timer"));
    await flushed();

    expect(history.closing(search("ideas=timer"))).toBe("back");
    expect(history.closing(search("ideas=timer"))).toBe("clear");
  });

  it("clears when the address moved on since the push", async () => {
    const history = createIdeasHistory();
    history.opened(landed("ideas=timer"));
    await flushed();

    expect(history.closing(search("ideas=timer&tab=discovered"))).toBe("clear");
  });

  it("keeps the entry when another seed replaces the pushed one", async () => {
    const history = createIdeasHistory();
    history.opened(landed("ideas=timer"));
    await flushed();
    history.switched(search("ideas=timer"), landed("ideas=clock"));
    await flushed();

    expect(history.closing(search("ideas=clock"))).toBe("back");
  });

  it("drops the entry when the seed is switched on a moved address", async () => {
    const history = createIdeasHistory();
    history.opened(landed("ideas=timer"));
    await flushed();
    history.switched(
      search("ideas=timer&q=focus"),
      landed("ideas=clock&q=focus"),
    );
    await flushed();

    expect(history.closing(search("ideas=clock&q=focus"))).toBe("clear");
  });

  it("forgets the entry when the address loses the seed", async () => {
    const history = createIdeasHistory();
    history.opened(landed("ideas=timer"));
    await flushed();
    history.cleared();

    expect(history.closing(search("ideas=timer"))).toBe("clear");
  });

  it("ignores a push that lands after Ideas closed", async () => {
    const history = createIdeasHistory();
    let land: (value: URLSearchParams) => void = () => undefined;
    history.opened(
      new Promise<URLSearchParams>((resolve) => {
        land = resolve;
      }),
    );
    history.cleared();
    land(search("ideas=timer"));
    await flushed();

    expect(history.closing(search("ideas=timer"))).toBe("clear");
  });
});
