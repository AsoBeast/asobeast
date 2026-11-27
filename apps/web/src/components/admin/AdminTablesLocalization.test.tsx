import { describe, expect, it, vi } from "vitest";
import { AdminApps } from "./AdminApps";
import { AdminUsers } from "./AdminUsers";
import { AdminWorkspaces } from "./AdminWorkspaces";
import { ListLimitNote } from "./ListLimitNote";
import { chineseMarkup } from "./admin-localization-test-utils";
import { adminUsersOptions } from "@/lib/queries";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

vi.mock("nuqs", () => ({
  useQueryStates: () => [
    {
      q: "",
      stage: [],
      flag: [],
      store: [],
      workspace: null,
      sort: "created",
      dir: null,
    },
    () => undefined,
  ],
  useQueryState: () => ["", () => undefined],
}));

describe("Simplified Chinese admin tables", () => {
  it("localizes the workspace table while preserving operator-authored reasons", () => {
    const markup = chineseMarkup(<AdminWorkspaces />);

    expect(markup).toContain("此实例上的工作区");
    for (const label of [
      "工作区",
      "阶段",
      "成员",
      "应用",
      "关键词市场",
      "创建时间",
    ]) {
      expect(markup).toContain(`>${label}<`);
    }
    expect(markup).toContain("Indie · 付费");
    expect(markup).toContain("已暂停");
    expect(markup).toContain("Sustained rate limit abuse");
    expect(markup).toContain('aria-label="Ana Apps 中的 2 个成员"');
    expect(markup).toContain('aria-label="Ana Apps 中的 2 个应用"');
    expect(markup).toContain("每次读取都会写入支持审计记录。");
    expect(markup).not.toContain("Workspaces on this instance");
  });

  it("localizes users and apps tables without translating account or app data", () => {
    const users = chineseMarkup(<AdminUsers />);
    const apps = chineseMarkup(<AdminApps />);

    expect(users).toContain("此实例上的账户");
    for (const label of [
      "账户",
      "角色",
      "邮箱",
      "工作区",
      "阶段",
      "加入时间",
    ]) {
      expect(users).toContain(`>${label}<`);
    }
    expect(users).toContain("所有者");
    expect(users).toContain("已确认");
    expect(users).toContain("平台运营者");
    expect(users).toContain("ana@example.com");
    expect(users).toContain('title="Ana Apps 中的应用"');
    expect(apps).toContain("此实例上已跟踪的应用");
    for (const label of [
      "应用",
      "应用商店",
      "主市场",
      "工作区",
      "竞品",
      "关键词市场",
      "添加时间",
    ]) {
      expect(apps).toContain(`>${label}<`);
    }
    expect(apps).toContain("未命名应用");
    expect(apps).toContain("中国");
    expect(apps).toContain("com.ana.habits");
    expect(apps).toContain('title="Ana Apps 中的账户"');
    expect(apps).toContain("不含竞品。每次读取都会写入支持审计记录。");
  });

  it("localizes empty lists and truncation notes", () => {
    const empty = chineseMarkup(<AdminUsers />, (client) => {
      client.setQueryData(adminUsersOptions().queryKey, {
        items: [],
        total: 0,
        limit: 1_000,
      });
    });
    const limited = chineseMarkup(
      <ListLimitNote shown={6} total={1_204} noun="account" />,
    );

    expect(empty).toContain("此实例上还没有账户");
    expect(limited).toContain("共 1,204 个账户，显示最新 6 个");
    expect(limited).toContain("打开一个工作区");
    expect(limited).not.toContain("Showing the newest");
  });
});
