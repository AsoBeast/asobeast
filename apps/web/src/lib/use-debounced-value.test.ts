import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "./use-debounced-value";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  it("applies the last value once the delay passed", () => {
    const apply = vi.fn();
    const scheduler = debounce<string>(400, apply);

    scheduler.push("habit");
    vi.advanceTimersByTime(399);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(apply).toHaveBeenCalledExactlyOnceWith("habit");
  });

  it("restarts the delay on every push", () => {
    const apply = vi.fn();
    const scheduler = debounce<string>(400, apply);

    scheduler.push("h");
    vi.advanceTimersByTime(300);
    scheduler.push("ha");
    vi.advanceTimersByTime(300);
    scheduler.push("hab");
    vi.advanceTimersByTime(399);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(apply).toHaveBeenCalledExactlyOnceWith("hab");
  });

  it("applies nothing after cancel", () => {
    const apply = vi.fn();
    const scheduler = debounce<string>(400, apply);

    scheduler.push("habit");
    scheduler.cancel();
    vi.advanceTimersByTime(1000);

    expect(apply).not.toHaveBeenCalled();
  });
});
