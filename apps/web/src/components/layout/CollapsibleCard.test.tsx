import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollapsedSectionsProvider } from "./CollapsedSections";
import { CollapsibleCard } from "./CollapsibleCard";

const card = (
  <CollapsibleCard
    section="a.one"
    eyebrow="Eyebrow"
    title="Section title"
    actions={<span>Beside the title</span>}
  >
    Body text
  </CollapsibleCard>
);

const render = (initial: readonly string[]) =>
  renderToStaticMarkup(
    <CollapsedSectionsProvider initial={initial} known={["a.one", "a.two"]}>
      {card}
    </CollapsedSectionsProvider>,
  );

describe("CollapsibleCard", () => {
  it("renders an open section with its content", () => {
    const markup = render([]);
    expect(markup).toContain("Body text");
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("aria-controls=");
  });

  it("renders a collapsed section without mounting its content", () => {
    const markup = render(["a.one"]);
    expect(markup).not.toContain("Body text");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('data-state="closed"');
    expect(markup).not.toContain("aria-controls=");
  });

  it("keeps the actions beside the title while collapsed", () => {
    expect(render(["a.one"])).toContain("Beside the title");
  });

  it("names the region after its title", () => {
    const markup = render([]);
    const region = /<div[^>]*role="region"[^>]*>/.exec(markup)?.[0] ?? "";
    const id = /aria-labelledby="([^"]+)"/.exec(region)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toMatch(
      new RegExp(`<h2[^>]*id="${id}"[^>]*><button[^>]*>Section title`),
    );
  });

  it("keeps card as the slot of the root", () => {
    const markup = render([]);
    expect(markup).toMatch(/^<div[^>]*data-slot="card"/);
    expect(markup).not.toContain('data-slot="collapsible"');
  });

  it("ignores a collapsed id the section does not own", () => {
    expect(render(["a.two"])).toContain("Body text");
  });

  it("refuses to render outside a provider", () => {
    expect(() => renderToStaticMarkup(card)).toThrow(
      /CollapsedSectionsProvider/,
    );
  });
});
