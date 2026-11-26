import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, adminHref, adminSectionFrom } from "./admin-sections";
import { translationContext } from "@/test/translation-context";

describe("admin sections", () => {
  it("never names a section after a route the web proxies to the api", () => {
    expect(ADMIN_SECTIONS.map((section) => section.segment)).not.toContain(
      "queues",
    );
  });

  it("links the overview to the admin root", () => {
    expect(adminHref("")).toBe("/admin");
    expect(adminHref("capacity")).toBe("/admin/capacity");
    expect(adminHref("users")).toBe("/admin/users");
  });

  it("reads the section from a pathname", () => {
    const zh = translationContext("zh-CN", "admin");
    const label = (pathname: string) => {
      const section = adminSectionFrom(pathname);
      return section ? zh.translator(section.labelKey) : null;
    };
    expect(label("/admin")).toBe("概览");
    expect(label("/admin/")).toBe("概览");
    expect(label("/admin/capacity/")).toBe("容量");
    expect(adminSectionFrom("/admin/capacity/extra")).toBeNull();
    expect(label("/admin/users/")).toBe("用户");
    expect(label("/admin/workspaces")).toBe("工作区");
    expect(label("/admin/apps")).toBe("应用");
    expect(label("/admin/conversion")).toBe("转化");
    expect(adminSectionFrom("/admin/queues")).toBeNull();
    expect(adminSectionFrom("/admin/queues/jobs")).toBeNull();
    expect(adminSectionFrom("/settings")).toBeNull();
  });
});
