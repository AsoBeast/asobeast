import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadMessages } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";
import { SidebarNav } from "./SidebarNav";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: undefined }),
  };
});

vi.mock("@/components/alerts/AlertsUnreadDot", () => ({
  AlertsUnreadDot: () => null,
}));

vi.mock("@/components/auth/use-auth", () => ({
  useAuth: () => ({
    status: { authenticated: true },
    isOperator: false,
  }),
}));

async function markup(locale: Locale) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={await loadMessages(locale)}
    >
      <SidebarProvider>
        <TooltipProvider>
          <SidebarNav />
        </TooltipProvider>
      </SidebarProvider>
    </NextIntlClientProvider>,
  );
}

describe("SidebarNav", () => {
  afterEach(() => {
    navigation.pathname = "/";
  });

  it("renders workspace navigation in the selected locale", async () => {
    const english = await markup("en");
    const chinese = await markup("zh-CN");

    expect(english).toContain("Dashboard");
    expect(english).toContain("Action Center");
    expect(chinese).toContain("工作区");
    expect(chinese).toContain("仪表盘");
    expect(chinese).toContain("行动中心");
    expect(chinese).toContain("提醒");
    expect(chinese).toContain("榜单");
    expect(chinese).toContain("关键词检查器");
    expect(chinese).toContain("集成");
    expect(chinese).toContain("设置");
    expect(chinese).not.toContain("Dashboard");
  });

  it("renders app-route navigation with a localized accessible name", async () => {
    navigation.pathname = "/apps/app-1/keywords";
    const english = await markup("en");
    const chinese = await markup("zh-CN");

    expect(english).toContain('<nav aria-label="App sections">');
    expect(chinese).toContain('<nav aria-label="应用分区">');
    expect(english).toContain(">Keywords</span>");
    expect(chinese).toContain(">关键词</span>");
  });
});
