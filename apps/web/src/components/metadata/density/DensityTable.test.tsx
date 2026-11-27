import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DensityTable } from "./DensityTable";

describe("DensityTable", () => {
  it("lets a long word wrap inside its cell", () => {
    const markup = renderToStaticMarkup(
      <DensityTable
        rows={[{ text: "produktivitätsmanagement", count: 2, share: 0.5 }]}
        caption="Most repeated words in the description"
        empty="No word repeats yet."
        noun="Word"
        marks={{ tracked: [], marked: null, onMark: () => {} }}
      />,
    );

    expect(markup).toMatch(/<bdi class="[^"]*\bwrap-anywhere\b[^"]*">/);
  });
});
