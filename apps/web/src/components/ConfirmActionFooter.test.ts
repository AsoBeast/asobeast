import { describe, expect, it, vi } from "vitest";
import { closeUnlessPending } from "./ConfirmActionFooter";

describe("closeUnlessPending", () => {
  it("opens and closes while nothing is pending", () => {
    const setOpen = vi.fn();

    closeUnlessPending(false, setOpen)(true);
    closeUnlessPending(false, setOpen)(false);

    expect(setOpen.mock.calls).toEqual([[true], [false]]);
  });

  it("keeps the dialog open while its request is pending", () => {
    const setOpen = vi.fn();

    closeUnlessPending(true, setOpen)(false);

    expect(setOpen).not.toHaveBeenCalled();
  });

  it("still opens while a request is pending", () => {
    const setOpen = vi.fn();

    closeUnlessPending(true, setOpen)(true);

    expect(setOpen).toHaveBeenCalledWith(true);
  });
});
