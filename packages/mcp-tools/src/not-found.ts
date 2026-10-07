import type { McpTool } from "./define";

const MISSING_ROUTE_MESSAGE = /^Cannot GET \//;

export function notFoundText(tool: McpTool, apiMessage: string): string {
  if (tool.kind === "write" || tool.unavailableOn404 === undefined) {
    return apiMessage;
  }
  return MISSING_ROUTE_MESSAGE.test(apiMessage)
    ? tool.unavailableOn404
    : apiMessage;
}
