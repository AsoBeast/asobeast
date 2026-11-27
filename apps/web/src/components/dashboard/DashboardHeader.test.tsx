import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/locale";
import { DashboardHeader } from "./DashboardHeader";

const serverLocale = vi.hoisted(() => ({ value: "en" as Locale }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { catalogs } = await import("@/i18n/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({
        locale: serverLocale.value,
        namespace,
        messages: catalogs[serverLocale.value] as Parameters<
          typeof createTranslator
        >[0]["messages"],
      }),
  };
});

vi.mock("./DashboardRange", () => ({
  DashboardRange: () => null,
}));

vi.mock("@/components/apps/ImportAppDialog", () => ({
  ImportAppDialog: ({ children }: { children: React.ReactNode }) => children,
}));

async function markup(locale: Locale) {
  serverLocale.value = locale;
  return renderToStaticMarkup(await DashboardHeader({}));
}

describe("DashboardHeader", () => {
  it("server-renders the dashboard heading and import action in the selected locale", async () => {
    const english = await markup("en");
    const chinese = await markup("zh-CN");

    expect(english).toContain("Dashboard");
    expect(english).toContain("Import app");
    expect(chinese).toContain("仪表盘");
    expect(chinese).toContain("导入应用");
    expect(chinese).not.toContain("Dashboard");
  });
});
