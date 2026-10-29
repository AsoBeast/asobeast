import { describe, expect, it, vi } from "vitest";
import { untilStable } from "./settle";

const readings = (...values: string[]) => {
  const queue = [...values];
  return () => queue.shift() ?? values.at(-1) ?? "";
};

const still = () => false;

describe("untilStable", () => {
  it("returns after one pause when the markup did not change", async () => {
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(untilStable(() => "a", still, pause, 10)).resolves.toBe("a");

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("waits for an animation to stop changing the markup", async () => {
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(
      untilStable(
        readings("w=0", "w=40", "w=80", "w=100", "w=100"),
        still,
        pause,
        10,
      ),
    ).resolves.toBe("w=100");

    expect(pause).toHaveBeenCalledTimes(4);
  });

  it("keeps waiting while the markup rests between frames of a moving chart", async () => {
    const pause = vi.fn().mockResolvedValue(undefined);
    const moving = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    await expect(
      untilStable(
        readings("0px 400px", "0px 400px", "0px 400px", "6 3"),
        moving,
        pause,
        10,
      ),
    ).resolves.toBe("6 3");

    expect(pause).toHaveBeenCalledTimes(4);
  });

  it("gives up while the chart still moves at the check limit", async () => {
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(
      untilStable(
        () => "0px 400px",
        () => true,
        pause,
        3,
      ),
    ).resolves.toBe("0px 400px");

    expect(pause).toHaveBeenCalledTimes(3);
  });

  it("gives up after the check limit and returns the latest markup", async () => {
    let tick = 0;
    const pause = vi.fn().mockResolvedValue(undefined);

    await expect(
      untilStable(() => `reading ${(tick += 1)}`, still, pause, 3),
    ).resolves.toBe("reading 4");

    expect(pause).toHaveBeenCalledTimes(3);
  });
});
