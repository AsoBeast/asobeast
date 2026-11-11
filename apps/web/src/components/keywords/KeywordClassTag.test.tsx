import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeywordClass, KeywordClassSource } from "@asobeast/shared";
import { KeywordClassTag } from "./KeywordClassTag";

const render = (
  keywordClass: KeywordClass | undefined,
  source: KeywordClassSource | undefined = "detected",
) =>
  renderToStaticMarkup(
    <KeywordClassTag keywordClass={keywordClass} source={source} />,
  );

describe("KeywordClassTag", () => {
  it.each([
    ["ownBrand", "B", "Brand keyword"],
    ["competitorBrand", "CB", "Competitor brand keyword"],
  ] as const)(
    "shows %s as %s with its words for assistive technology",
    (keywordClass, letter, words) => {
      const markup = render(keywordClass);

      expect(markup).toContain(`title="${words}"`);
      expect(markup).toContain(`<span aria-hidden="true">${letter}</span>`);
      expect(markup).toContain(`<span class="sr-only">${words}</span>`);
    },
  );

  it("tells the two brands apart by more than colour", () => {
    expect(render("ownBrand")).toContain('<span aria-hidden="true">B</span>');
    expect(render("competitorBrand")).toContain(
      '<span aria-hidden="true">CB</span>',
    );
  });

  it("says the owner set the type", () => {
    const markup = render("ownBrand", "owner");

    expect(markup).toContain('title="Brand keyword, set by you"');
    expect(markup).toContain(
      '<span class="sr-only">Brand keyword, set by you</span>',
    );
  });

  it.each(["generic", undefined] as const)("renders nothing for %s", (type) => {
    expect(render(type)).toBe("");
  });

  it("keeps every text in an element of its own", () => {
    const markup = render("competitorBrand", "owner");
    const inner = markup.slice(
      markup.indexOf(">") + 1,
      markup.lastIndexOf("<"),
    );

    expect(inner).toBe(
      '<span aria-hidden="true">CB</span><span class="sr-only">Competitor brand keyword, set by you</span>',
    );
  });
});
