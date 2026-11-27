import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copy-text";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("writes the text and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("Habit Tracker")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Habit Tracker");
  });

  it("answers false when the clipboard refuses", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await expect(copyText("Habit Tracker")).resolves.toBe(false);
  });

  it("answers false when there is no clipboard", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyText("Habit Tracker")).resolves.toBe(false);
  });
});
