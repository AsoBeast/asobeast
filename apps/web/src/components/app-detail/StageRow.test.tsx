import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TestIntlProvider } from "@/test/intl-provider";
import { StageRow } from "./StageRow";

describe("Simplified Chinese run stages", () => {
  it("localizes the default waiting state used by first-run timelines", () => {
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <ul>
          <StageRow
            label="已检查排名"
            ready={false}
            progress="2 / 10"
            detail="活跃关键词的排名。"
          />
        </ul>
      </TestIntlProvider>,
    );

    expect(markup).toContain("等待中 · 2 / 10");
    expect(markup).not.toContain("Waiting");
  });
});
