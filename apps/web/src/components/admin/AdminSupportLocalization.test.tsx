import { describe, expect, it, vi } from "vitest";
import { SupportActionDialog } from "./workspace-sheet/SupportActionDialog";
import { WorkspaceSheet } from "./workspace-sheet/WorkspaceSheet";
import { chineseMarkup, WORKSPACE } from "./admin-localization-test-utils";

vi.mock("@/components/ui/sheet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/sheet")>();
  return {
    ...actual,
    Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SheetTrigger: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    SheetContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SheetHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SheetTitle: ({ children }: { children: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    SheetDescription: ({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    ),
  };
});

vi.mock("@/components/ui/alert-dialog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/alert-dialog")>();
  return {
    ...actual,
    AlertDialog: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    ),
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogAction: (props: React.ComponentProps<"button">) => (
      <button {...props} />
    ),
    AlertDialogCancel: (props: React.ComponentProps<"button">) => (
      <button {...props} />
    ),
  };
});

describe("Simplified Chinese admin support", () => {
  it("localizes the support sheet, audit log, checks, failed jobs, and actions", () => {
    const pending = chineseMarkup(
      <WorkspaceSheet shownId="ws_pending" billing onClose={() => undefined} />,
    );
    const markup = chineseMarkup(
      <WorkspaceSheet shownId="ws_ana" billing onClose={() => undefined} />,
    );

    expect(pending).toContain("一个工作区的支持详情。");
    expect(markup).toContain("套餐和日期");
    expect(markup).toContain("套餐限制与用量");
    expect(markup).toContain(">已用和允许量<");
    expect(markup).toContain("每天 50 次");
    expect(markup).toContain("上周关键词检查");
    expect(markup).toContain("失败的应用商店任务");
    expect(markup).toContain("访问日志");
    expect(markup).toContain("已查看");
    expect(markup).toContain("进行中");
    expect(markup).toContain("API-provided detail");
    expect(markup).toContain("Store answered 503 Service Unavailable");
    expect(markup).toContain("支持操作");
    expect(markup).toContain(">运行每日任务<");
    expect(markup).toContain(">对账账单<");
    expect(markup).toContain(">暂停<");
    expect(markup).not.toContain("Support actions");
  });

  it("localizes support confirmation dialogs and reason guidance", () => {
    const markup = chineseMarkup(
      <SupportActionDialog workspace={WORKSPACE} billing action="suspend" />,
    );

    expect(markup).toContain("暂停 Ana Apps？");
    expect(markup).toContain("每个成员都会在每个页面看到此原因");
    expect(markup).toContain(">原因<");
    expect(markup).toContain("至少 8 个字符。将保留在支持访问日志中。");
    expect(markup).toContain(">暂停工作区<");
    expect(markup).toContain(">取消<");
    expect(markup).not.toContain("Suspend Ana Apps?");
  });
});
