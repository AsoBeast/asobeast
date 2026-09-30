import { describe, expect, it } from "vitest";
import { notFoundText, toolByName, type ReadTool } from "./index";

function catalogTool(name: string): ReadTool {
  const tool = toolByName(name);
  if (!tool) throw new Error(`${name} is not in the tool catalog`);
  return tool;
}

const auditHistory = catalogTool("audit_history");
const getApp = catalogTool("get_app");

describe("notFoundText", () => {
  it("reports a newer api when the route does not exist", () => {
    expect(
      notFoundText(auditHistory, "Cannot GET /apps/app-1/audit/history"),
    ).toBe(auditHistory.unavailableOn404);
  });

  it("reports a newer api when the missing route carried a query string", () => {
    expect(
      notFoundText(auditHistory, "Cannot GET /apps/app-1/audit/history?from=x"),
    ).toBe(auditHistory.unavailableOn404);
  });

  it("keeps the api message when the app does not exist", () => {
    expect(notFoundText(auditHistory, "App nope not found")).toBe(
      "App nope not found",
    );
  });

  it("keeps the api message when the action does not exist", () => {
    expect(notFoundText(catalogTool("get_action"), "Action not found")).toBe(
      "Action not found",
    );
  });

  it("does not mistake an app id that reads like a route for a route", () => {
    const message = "App Cannot GET /x not found";

    expect(notFoundText(auditHistory, message)).toBe(message);
  });

  it("keeps a message with no envelope behind it", () => {
    const message = "Request failed with status 404.";

    expect(notFoundText(auditHistory, message)).toBe(message);
  });

  it("invents nothing for a tool with no upgrade note", () => {
    expect(getApp.unavailableOn404).toBeUndefined();
    expect(notFoundText(getApp, "Cannot GET /apps/app-1")).toBe(
      "Cannot GET /apps/app-1",
    );
  });
});
