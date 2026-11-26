import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CountrySelect } from "@/components/CountrySelect";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { FiltersPopover } from "@/components/data-table/FiltersControl";
import { ErrorState } from "@/components/layout/ErrorState";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadMessages } from "@/i18n/messages";

vi.mock("@/components/auth/use-auth", () => ({
  useAuth: () => ({
    status: { authenticated: true, billing: true },
    isOperator: false,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/layout/AppSwitcher", () => ({
  AppSwitcher: () => null,
}));

vi.mock("@/components/layout/SidebarNav", () => ({
  SidebarNav: () => null,
}));

vi.mock("@/lib/whats-new/seen-release", () => ({
  useSeenRelease: () => ["v1.16.0"],
}));

async function chineseMarkup(node: React.ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="zh-CN"
      timeZone="UTC"
      messages={await loadMessages("zh-CN")}
    >
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <SidebarProvider>{node}</SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("shared localization foundation", () => {
  it("renders Chinese shared controls, shell, and error recovery copy", async () => {
    const messages = await loadMessages("zh-CN");
    const controls = await chineseMarkup(
      <>
        <Dialog>
          <DialogFooter showCloseButton>操作</DialogFooter>
        </Dialog>
        <Toaster />
        <FiltersPopover active={0} otherWidth={createRef<HTMLElement>()}>
          <span>市场</span>
        </FiltersPopover>
        <ExportCsvButton subject="Focus Timer" onClick={() => undefined} />
        <CountrySelect
          store="APP_STORE"
          value="us"
          onChange={() => undefined}
          ariaLabel="市场"
        />
        <CountrySelect
          store="APP_STORE"
          value="xx"
          onChange={() => undefined}
          ariaLabel="市场"
        />
      </>,
    );
    const shell = await chineseMarkup(<AppSidebar />);
    const error = await chineseMarkup(
      <ErrorState error={new Error("boom")} retry={() => undefined} />,
    );

    expect(controls).toContain(">关闭</span>");
    expect(messages).toHaveProperty("ui.dismiss", "忽略");
    expect(controls).toContain('aria-label="通知 alt+T"');
    expect(controls).toContain("筛选");
    expect(controls).toContain("导出 CSV");
    expect(controls).toContain("Focus Timer");
    expect(controls).toContain("US · 美国");
    expect(controls).toContain("App Store 没有代码为 XX 的应用商店地区。");
    expect(controls).not.toContain("Dismiss");
    expect(shell).toContain("帮助文档");
    expect(shell).toContain("服务条款");
    expect(shell).toContain("隐私政策");
    expect(shell).toContain("切换侧边栏");
    expect(shell).not.toContain("Documentation");
    expect(error).toContain("出了点问题");
    expect(error).toContain("重试");
    expect(error).not.toContain("Something went wrong");
  });
});
