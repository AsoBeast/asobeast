import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { importColumns, type PreviewRow } from "./import-columns";

const ROW: PreviewRow = {
  index: 0,
  line: 2,
  keyword: "focus timer",
  country: "us",
  status: "new",
};

function cellOf(id: string, row: PreviewRow): string {
  const column = importColumns([2]).find((each) => each.id === id);
  const cell = column?.cell;
  if (typeof cell !== "function") throw new Error(`no cell for ${id}`);
  const render = cell as (context: {
    row: { original: PreviewRow };
  }) => unknown;
  return renderToString(render({ row: { original: row } }) as ReactElement);
}

describe("importColumns", () => {
  it("renders each cell as an element, never as bare text", () => {
    for (const id of ["line", "keyword", "country", "status", "details"]) {
      expect(cellOf(id, ROW)).toMatch(/^<[a-z]/);
    }
  });

  it("shows the market in capitals", () => {
    expect(cellOf("country", ROW)).toBe("<span>US</span>");
  });
});
