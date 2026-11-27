import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMetadata from "../../messages/en/metadata.json";
import zhMetadata from "../../messages/zh-CN/metadata.json";
import { MetadataFieldCard } from "./MetadataFieldCard";

const render = (indexed: boolean, locale: "en" | "zh-CN" = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ metadata: locale === "en" ? enMetadata : zhMetadata }}
    >
      <MetadataFieldCard
        field="title"
        value="Focus Timer"
        limit={30}
        indexed={indexed}
        issues={[]}
      />
    </NextIntlClientProvider>,
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

  it("labels a field and its limit in Simplified Chinese", () => {
    const markup = render(false, "zh-CN");

    expect(markup).toContain(">标题<");
    expect(markup).toContain("商店不会搜索此字段");
    expect(markup).toContain("11/30");
  });

  it("explains a field the store does not search", () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        timeZone="UTC"
        messages={{ metadata: enMetadata }}
      >
        <MetadataFieldCard
          field="description"
          value="A calm focus timer."
          limit={4000}
          indexed={false}
          issues={[]}
        />
      </NextIntlClientProvider>,
    );

    expect(markup).toContain("Not searched by the store");
    expect(markup).toContain(
      'aria-label="Why the store does not search Description"',
    );
  });

  it("keeps the character count in either case", () => {
    expect(render(true)).toContain("11/30");
    expect(render(false)).toContain("11/30");
  });
});
