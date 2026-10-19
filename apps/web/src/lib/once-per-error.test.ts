import { describe, expect, it, vi } from "vitest";
import { oncePerError } from "./once-per-error";

describe("oncePerError", () => {
  it("runs the action once for repeated presses on the same error", () => {
    const once = oncePerError();
    const action = vi.fn();
    const error = new Error("failed");

    once(error, action);
    once(error, action);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("runs the action again for a new error", () => {
    const once = oncePerError();
    const action = vi.fn();

    once(new Error("failed"), action);
    once(new Error("failed again"), action);

    expect(action).toHaveBeenCalledTimes(2);
  });
});
