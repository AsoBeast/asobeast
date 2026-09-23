import { describe, expect, it } from "vitest";
import {
  parseColumnVisibility,
  readStoredColumns,
  writeColumnVisibility,
} from "./column-visibility";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

const throwing = (): Storage => {
  throw new Error("storage is blocked");
};

describe("parseColumnVisibility", () => {
  it("reads nothing stored as no preference", () => {
    expect(parseColumnVisibility(null)).toBeNull();
  });

  it.each(["not json", "[]", "null", '"source"', '{"source":"no"}'])(
    "ignores the invalid value %s",
    (raw) => {
      expect(parseColumnVisibility(raw)).toBeNull();
    },
  );

  it("reads a map of column ids to booleans", () => {
    expect(parseColumnVisibility('{"source":false,"traffic":true}')).toEqual({
      source: false,
      traffic: true,
    });
  });
});

describe("stored column visibility", () => {
  it("round trips through storage under one key per table", () => {
    const storage = memoryStorage();
    expect(
      writeColumnVisibility(() => storage, "keywords", { source: false }),
    ).toBe(true);
    expect(storage.getItem("asobeast.columns.keywords")).toBe(
      '{"source":false}',
    );
    expect(
      parseColumnVisibility(readStoredColumns(() => storage, "keywords")),
    ).toEqual({ source: false });
    expect(readStoredColumns(() => storage, "comparison")).toBeNull();
  });

  it("reads nothing from a storage that throws", () => {
    expect(readStoredColumns(throwing, "keywords")).toBeNull();
  });

  it("reports a write to a storage that throws as not saved", () => {
    expect(writeColumnVisibility(throwing, "keywords", {})).toBe(false);
  });
});
