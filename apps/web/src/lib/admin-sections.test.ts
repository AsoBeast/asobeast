import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, adminHref, adminSectionFrom } from "./admin-sections";

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
    expect(adminSectionFrom("/admin")?.label).toBe("Overview");
    expect(adminSectionFrom("/admin/")?.label).toBe("Overview");
    expect(adminSectionFrom("/admin/capacity/")?.label).toBe("Capacity");
    expect(adminSectionFrom("/admin/capacity/extra")).toBeNull();
    expect(adminSectionFrom("/admin/users/")?.label).toBe("Users");
    expect(adminSectionFrom("/admin/workspaces")?.label).toBe("Workspaces");
    expect(adminSectionFrom("/admin/apps")?.label).toBe("Apps");
    expect(adminSectionFrom("/admin/queues")).toBeNull();
    expect(adminSectionFrom("/admin/queues/jobs")).toBeNull();
    expect(adminSectionFrom("/settings")).toBeNull();
  });
});
