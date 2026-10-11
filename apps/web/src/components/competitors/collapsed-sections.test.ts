import { describe, expect, it } from "vitest";
import { readCollapsed, writeCollapsed } from "./collapsed-sections";

function memory() {
  const items = new Map<string, string>();
  return () => ({
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  });
}

const broken = () => {
  throw new Error("storage is blocked");
};

describe("collapsed sections", () => {
  it("starts every section expanded", () => {
    expect(readCollapsed(memory(), "matrix")).toBe(false);
  });

  it("remembers a collapsed section and forgets it once expanded", () => {
    const storage = memory();
    writeCollapsed(storage, "matrix", true);
    expect(readCollapsed(storage, "matrix")).toBe(true);
    expect(readCollapsed(storage, "discovery")).toBe(false);

    writeCollapsed(storage, "matrix", false);
    expect(readCollapsed(storage, "matrix")).toBe(false);
  });

  it("stays expanded when storage is unavailable", () => {
    expect(readCollapsed(broken, "matrix")).toBe(false);
    expect(() => writeCollapsed(broken, "matrix", true)).not.toThrow();
  });
});
