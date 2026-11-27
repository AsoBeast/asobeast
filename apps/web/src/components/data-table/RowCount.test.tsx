import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TestIntlProvider } from "@/test/intl-provider";
import type { Locale } from "@/lib/locale";
import { RowCount } from "./RowCount";

const render = (locale: Locale, shown: number, total: number) =>
  renderToStaticMarkup(
    <TestIntlProvider locale={locale}>
      <RowCount shown={shown} total={total} noun="keyword" />
    </TestIntlProvider>,
  );

describe("RowCount", () => {
  it("keeps shown and total in emphasized numeric spans", () => {
    const html = render("en", 2, 1234);

    expect(html).toContain(
      '<span class="numeric font-medium text-foreground">2</span>',
    );
    expect(html).toContain(
      '<span class="numeric font-medium text-foreground">1,234</span>',
    );
    expect(html).toContain("<span>keywords</span>");
  });

  it("keeps the numeric spans and Chinese noun order", () => {
    const html = render("zh-CN", 2, 1234);

    expect(html).toContain(
      '<span class="numeric font-medium text-foreground">2</span>',
    );
    expect(html).toContain(
      '<span class="numeric font-medium text-foreground">1,234</span>',
    );
    expect(html).toContain("显示 ");
    expect(html).toContain(" 个，共 ");
    expect(html).toContain("<span>个关键词</span>");
  });

  it("uses the singular English noun for one row", () => {
    expect(render("en", 1, 1)).toContain("<span>keyword</span>");
    expect(render("en", 1, 1)).not.toContain("<span>keywords</span>");
  });
});
