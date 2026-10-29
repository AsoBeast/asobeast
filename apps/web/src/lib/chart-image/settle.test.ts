import { describe, expect, it, vi } from "vitest";
import { untilStable } from "./settle";

const readings = (...values: string[]) => {
  const queue = [...values];
  return () => queue.shift() ?? values.at(-1) ?? "";
};

describe("untilStable", () => {
  it("returns after one pause when the markup did not change", async () => {
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(untilStable(() => "a", pause, 10)).resolves.toBe("a");

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("waits for an animation to stop changing the markup", async () => {
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(
      untilStable(readings("w=0", "w=40", "w=80", "w=100", "w=100"), pause, 10),
    ).resolves.toBe("w=100");

    expect(pause).toHaveBeenCalledTimes(4);
  });

  it("gives up after the check limit and returns the latest markup", async () => {
    let tick = 0;
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(
      untilStable(() => `reading ${(tick += 1)}`, pause, 3),
    ).resolves.toBe("reading 4");

    expect(pause).toHaveBeenCalledTimes(3);
  });
});
