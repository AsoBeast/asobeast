import { describe, expect, it } from "vitest";
import { openerFor } from "./breakdown-opener";

const element = (keywordId: string, isConnected = true) =>
  ({
    isConnected,
    dataset: { breakdownKeyword: keywordId },
  }) as unknown as HTMLElement;

describe("openerFor", () => {
  it("answers the remembered button of the keyword the sheet showed", () => {
    const button = element("kw-4");

    expect(openerFor(button, "kw-4")).toBe(button);
  });

  it("answers nothing for a button of another keyword", () => {
    expect(openerFor(element("kw-4"), "kw-2")).toBeNull();
  });

  it("answers nothing for a button no longer on the page", () => {
    expect(openerFor(element("kw-4", false), "kw-4")).toBeNull();
  });

  it("answers nothing before any button was pressed", () => {
    expect(openerFor(null, "kw-4")).toBeNull();
  });
});
