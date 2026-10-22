import { KEYWORD_SORTS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  ariaSort,
  nullsLast,
  parseStoredSort,
  readStoredSort,
  removeStoredSort,
  sortDefaultsOf,
  sortingFromUrl,
  urlFromSorting,
  writeStoredSort,
  type SortDefaults,
} from "./sorting";

const DEFAULTS: SortDefaults = {
  descFirst: new Set(["traffic", "difficulty", "opportunity", "volatility"]),
};

describe("sortingFromUrl", () => {
  it("sorts position ascending when the url names no direction", () => {
    expect(sortingFromUrl("position", null, DEFAULTS)).toEqual([
      { id: "position", desc: false },
    ]);
  });

  it.each(KEYWORD_SORTS.filter((sort) => sort !== "position"))(
    "sorts %s descending when the url names no direction",
    (sort) => {
      expect(sortingFromUrl(sort, null, DEFAULTS)).toEqual([
        { id: sort, desc: true },
      ]);
    },
  );
});

describe("sortingFromUrl with a direction", () => {
  it("lets the url reverse the natural direction", () => {
    expect(sortingFromUrl("traffic", "asc", DEFAULTS)).toEqual([
      { id: "traffic", desc: false },
    ]);
  });

  it("keeps an explicit descending direction", () => {
    expect(sortingFromUrl("position", "desc", DEFAULTS)).toEqual([
      { id: "position", desc: true },
    ]);
  });
});

describe("urlFromSorting", () => {
  it("drops the direction when it is the column's natural one", () => {
    expect(urlFromSorting([{ id: "traffic", desc: true }], DEFAULTS)).toEqual({
      sort: "traffic",
      dir: null,
    });
  });

  it("writes ascending when a descending column is reversed", () => {
    expect(urlFromSorting([{ id: "traffic", desc: false }], DEFAULTS)).toEqual({
      sort: "traffic",
      dir: "asc",
    });
  });

  it("drops the direction for position ascending", () => {
    expect(urlFromSorting([{ id: "position", desc: false }], DEFAULTS)).toEqual(
      { sort: "position", dir: null },
    );
  });

  it("writes descending when position is reversed", () => {
    expect(urlFromSorting([{ id: "position", desc: true }], DEFAULTS)).toEqual({
      sort: "position",
      dir: "desc",
    });
  });

  it("clears both keys for an empty state", () => {
    expect(urlFromSorting([], DEFAULTS)).toEqual({ sort: null, dir: null });
  });
});

describe("ariaSort", () => {
  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
    [false, undefined],
  ] as const)("maps %s to %s", (sorted, expected) => {
    expect(ariaSort(sorted)).toBe(expected);
  });
});

describe("nullsLast", () => {
  it("turns null into undefined so the table sinks it", () => {
    expect(nullsLast(null)).toBeUndefined();
  });

  it("keeps a zero", () => {
    expect(nullsLast(0)).toBe(0);
  });
});

describe("sortDefaultsOf", () => {
  it("reads the natural direction from the column definitions", () => {
    expect(
      sortDefaultsOf([
        { id: "keyword", sortDescFirst: false },
        { id: "traffic", sortDescFirst: true },
        { id: "select" },
        { sortDescFirst: true },
      ]),
    ).toEqual({ descFirst: new Set(["traffic"]) });
  });
});

describe("stored sort", () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      storage: () => ({
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        removeItem: (key: string) => void map.delete(key),
      }),
      map,
    };
  };
  const KNOWN = new Set(["keyword", "traffic", "opportunity"]);

  it("round trips the sort the viewer chose", () => {
    const { storage } = memory();
    expect(
      writeStoredSort(storage, "keywords", { sort: "traffic", dir: null }),
    ).toBe(true);
    expect(readStoredSort(storage, "keywords")).toBe(
      JSON.stringify({ sort: "traffic", dir: null }),
    );
    expect(parseStoredSort(readStoredSort(storage, "keywords"), KNOWN)).toEqual(
      {
        sort: "traffic",
        dir: null,
      },
    );
  });

  it("drops the stored sort so the table opens unsorted again", () => {
    const { storage } = memory();
    writeStoredSort(storage, "keywords", { sort: "traffic", dir: null });
    removeStoredSort(storage, "keywords");
    expect(readStoredSort(storage, "keywords")).toBeNull();
  });

  it("keeps an explicit direction", () => {
    expect(
      parseStoredSort(JSON.stringify({ sort: "keyword", dir: "asc" }), KNOWN),
    ).toEqual({ sort: "keyword", dir: "asc" });
  });

  it("drops an unknown direction rather than the entry", () => {
    expect(
      parseStoredSort(JSON.stringify({ sort: "keyword", dir: "up" }), KNOWN),
    ).toEqual({ sort: "keyword", dir: null });
  });

  it("forgets a sort that is no longer a column of the table", () => {
    expect(
      parseStoredSort(JSON.stringify({ sort: "relevance", dir: null }), KNOWN),
    ).toBeNull();
  });

  it("forgets a stored value that is not a sort", () => {
    expect(parseStoredSort(JSON.stringify({ sort: 42 }), KNOWN)).toBeNull();
    expect(parseStoredSort(JSON.stringify(["traffic"]), KNOWN)).toBeNull();
    expect(parseStoredSort("not json", KNOWN)).toBeNull();
  });

  it("answers nothing when nothing was stored or storage refuses", () => {
    const { storage } = memory();
    expect(readStoredSort(storage, "keywords")).toBeNull();
    expect(parseStoredSort(null, KNOWN)).toBeNull();
    expect(
      readStoredSort(() => {
        throw new Error("blocked");
      }, "keywords"),
    ).toBeNull();
    expect(
      writeStoredSort(
        () => {
          throw new Error("blocked");
        },
        "keywords",
        { sort: "traffic", dir: null },
      ),
    ).toBe(false);
  });
});
