import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetadataFieldCard } from "./MetadataFieldCard";

const render = (indexed: boolean) =>
  renderToStaticMarkup(
    <MetadataFieldCard
      field="title"
      value="Focus Timer"
      limit={30}
      indexed={indexed}
      issues={[]}
    />,
  );

describe("MetadataFieldCard", () => {
  it("says nothing extra about a field the store searches", () => {
    const markup = render(true);

    expect(markup).toContain(">Title<");
    expect(markup).not.toContain("Not searched by the store");
  });

  it("labels a field the store does not search, beside its name", () => {
    const markup = render(false);

    expect(markup).toContain(">Title<");
    expect(markup).toContain("Not searched by the store");
  });

  it("keeps the character count in either case", () => {
    expect(render(true)).toContain("11/30");
    expect(render(false)).toContain("11/30");
  });
});
