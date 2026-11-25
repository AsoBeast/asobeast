import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeywordMover } from "@asobeast/shared";
import { daysPeriod } from "./mover-change";
import { MoverList } from "./MoverList";

const mover = (over: Partial<KeywordMover>): KeywordMover => ({
  keywordId: "kw-1",
  text: "focus timer",
  from: 14,
  fromDepth: 200,
  to: null,
  toDepth: 200,
  ...over,
});

const render = (movers: KeywordMover[]) =>
  renderToStaticMarkup(
    <MoverList
      movers={movers}
      period={daysPeriod(7)}
      empty="Nothing moved"
      hrefOf={() => "/rankings"}
      lead={(entry) => <bdi>{entry.text}</bdi>}
    />,
  );

describe("MoverList", () => {
  it("reads a side whose search lists no apps as No apps", () => {
    const markup = render([
      mover({ toResultCount: 0 }),
      mover({ from: null, fromResultCount: 0, to: 9 }),
    ]);

    expect(markup).toContain(">No apps</span>");
    expect(markup).toContain(">9</span>");
  });

  it("keeps the bound on a side without a result count", () => {
    expect(render([mover({})])).toContain("&gt;200</span>");
    expect(render([mover({ to: 9 })])).toContain(">9</span>");
  });
});
