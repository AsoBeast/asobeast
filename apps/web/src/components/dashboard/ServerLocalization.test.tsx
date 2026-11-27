import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/locale";
import { SetupChecklistSkeleton } from "@/components/onboarding/SetupChecklistSkeleton";
import { AppsDashboardSkeleton } from "./AppsDashboardSkeleton";

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

async function skeletonMarkup(
  skeleton: () => Promise<React.ReactNode> | React.ReactNode,
  locale: Locale,
): Promise<string> {
  serverLocale.value = locale;
  return renderToStaticMarkup(await skeleton());
}

describe("server-rendered localization skeletons", () => {
  it("renders the apps skeleton heading in English and Chinese", async () => {
    const english = await skeletonMarkup(
      () => AppsDashboardSkeleton({ view: "table" }),
      "en",
    );
    const chinese = await skeletonMarkup(
      () => AppsDashboardSkeleton({ view: "table" }),
      "zh-CN",
    );

    expect(english).toContain(">Apps</h2>");
    expect(chinese).toContain(">应用</h2>");
    expect(chinese).not.toContain(">Apps</h2>");
  });

  it("renders the setup skeleton accessible name in English and Chinese", async () => {
    const english = await skeletonMarkup(SetupChecklistSkeleton, "en");
    const chinese = await skeletonMarkup(SetupChecklistSkeleton, "zh-CN");

    expect(english).toContain('aria-label="Loading setup"');
    expect(chinese).toContain('aria-label="正在加载设置"');
    expect(chinese).not.toContain('aria-label="Loading setup"');
  });
});
