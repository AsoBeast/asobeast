import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkLegend, MatchedText } from "./MatchedText";

describe("MatchedText", () => {
  it("marks the exact and folded runs, the folded one dotted and named", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[
          { text: "Focus", match: "exact" },
          { text: " ", match: "none" },
          { text: "Timér", match: "folded" },
        ]}
      />,
    );

    const marks = markup.split("<mark").slice(1);
    expect(marks).toHaveLength(2);
    expect(marks[0]).not.toContain("decoration-dotted");
    expect(marks[1]).toContain("decoration-dotted");
    expect(marks[1]).toContain(
      '<span class="sr-only"> (accents differ)</span>',
    );
  });

  it.each([[[]], [null]])(
    "renders the fallback without marks for %j",
    (segments) => {
      const markup = renderToStaticMarkup(
        <MatchedText segments={segments} fallback="Focus Timer" />,
      );

      expect(markup).toBe("<span>Focus Timer</span>");
    },
  );

  it("gives each run of text an element of its own, so a new title rewrites it whole", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[
          { text: "Focus", match: "exact" },
          { text: " Timer ", match: "none" },
          { text: "Pró", match: "folded" },
        ]}
      />,
    );

    expect(markup).toContain(">Focus</mark>");
    expect(markup).toContain("<span> Timer </span>");
    expect(markup).toContain(
      '<span>Pró</span><span class="sr-only"> (accents differ)</span></mark>',
    );
  });

  it.each([
    ["subtitle", "bg-info-subtle", "decoration-info", " (in subtitle)"],
    [
      "keywordField",
      "bg-warning-subtle",
      "decoration-warning",
      " (in keyword field)",
    ],
    ["title", "bg-success-subtle", "decoration-success", " (in title)"],
    [
      "shortDescription",
      "bg-info-subtle",
      "decoration-info",
      " (in short description)",
    ],
  ] as const)(
    "tints a %s mark and names where it was found",
    (surface, tint, decoration, label) => {
      const markup = renderToStaticMarkup(
        <MatchedText segments={[{ text: "study", surface, match: "exact" }]} />,
      );

      expect(markup).toContain("<mark");
      expect(markup).toContain(tint);
      expect(markup).toContain(decoration);
      expect(markup).toContain(
        `<span>study</span><span class="sr-only">${label}</span>`,
      );
    },
  );

  it("names the surface and the folded accents in one label", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[{ text: "cafe", surface: "title", match: "folded" }]}
      />,
    );

    expect(markup).toContain("decoration-dotted");
    expect(markup).toContain(
      '<span class="sr-only"> (in title, accents differ)</span>',
    );
  });

  it("draws a run with no surface the way the breakdown always has", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[
          { text: "Focus", match: "exact" },
          { text: "Timér", match: "folded" },
        ]}
      />,
    );

    expect(markup).toContain(">Focus</mark>");
    expect(markup).toContain("bg-success-subtle");
    expect(markup).toContain(
      '<span>Timér</span><span class="sr-only"> (accents differ)</span>',
    );
  });

  it("draws a listing run without a match as plain text", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[
          { text: "focus", surface: "title", match: "exact" },
          { text: " app", surface: null },
        ]}
      />,
    );

    expect(markup.split("<mark")).toHaveLength(2);
    expect(markup).toContain("<span> app</span>");
  });

  it("writes each hidden label as one text node", () => {
    const markup = renderToStaticMarkup(
      <MatchedText
        segments={[{ text: "focus", surface: "title", match: "folded" }]}
      />,
    );

    expect(markup).not.toContain("<!-- -->");
  });

  it.each([
    [
      ["title", "subtitle", "keywordField"],
      ["Title", "Subtitle", "Keyword field"],
    ],
    [
      ["title", "shortDescription"],
      ["Title", "Short description"],
    ],
  ] as const)(
    "names the tint of each surface in the legend %j",
    (surfaces, names) => {
      const markup = renderToStaticMarkup(<MarkLegend surfaces={surfaces} />);
      const chips = markup.split("<mark").slice(1);

      expect(chips).toHaveLength(names.length);
      names.forEach((name, index) => {
        expect(chips[index]).toContain(`>${name}</mark>`);
      });
      expect(chips[0]).toContain("bg-success-subtle");
    },
  );
});
