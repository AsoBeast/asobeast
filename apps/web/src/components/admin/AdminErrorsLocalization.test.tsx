import { describe, expect, it } from "vitest";
import { chineseMarkup } from "./admin-localization-test-utils";
import AdminOverviewError from "@/app/(app)/admin/error";
import AdminAppsError from "@/app/(app)/admin/apps/error";
import AdminCapacityError from "@/app/(app)/admin/capacity/error";
import AdminConversionError from "@/app/(app)/admin/conversion/error";
import AdminUsersError from "@/app/(app)/admin/users/error";
import AdminWorkspacesError from "@/app/(app)/admin/workspaces/error";

describe("Simplified Chinese admin errors", () => {
  it("localizes every admin route error boundary", () => {
    const error = new Error("API detail");
    const markup = chineseMarkup(
      <>
        <AdminOverviewError error={error} retry={() => undefined} />
        <AdminAppsError error={error} retry={() => undefined} />
        <AdminCapacityError error={error} retry={() => undefined} />
        <AdminConversionError error={error} retry={() => undefined} />
        <AdminUsersError error={error} retry={() => undefined} />
        <AdminWorkspacesError error={error} retry={() => undefined} />
      </>,
    );

    for (const title of [
      "无法加载管理概览",
      "无法加载已跟踪的应用",
      "无法加载实例容量",
      "无法加载转化数据",
      "无法加载账户",
      "无法加载工作区",
    ]) {
      expect(markup).toContain(title);
    }
    expect(markup).toContain(">重试<");
    expect(markup).not.toContain("could not be loaded");
  });
});
