import type { ReadTool } from "./define";

const MISSING_ROUTE_MESSAGE = /^Cannot GET \//;

export function notFoundText(tool: ReadTool, apiMessage: string): string {
  if (tool.unavailableOn404 === undefined) return apiMessage;
  return MISSING_ROUTE_MESSAGE.test(apiMessage)
    ? tool.unavailableOn404
    : apiMessage;
}
