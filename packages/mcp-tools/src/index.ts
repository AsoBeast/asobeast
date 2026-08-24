import { ACTION_TOOLS } from "./actions";
import { APP_TOOLS } from "./apps";
import { INSIGHT_TOOLS } from "./insights";
import { KEYWORD_TOOLS } from "./keywords";
import type { ReadTool } from "./define";

export * from "./define";
export { ACTION_TOOLS } from "./actions";
export { APP_TOOLS } from "./apps";
export { INSIGHT_TOOLS } from "./insights";
export { KEYWORD_TOOLS } from "./keywords";

export const MCP_TOOLS: ReadTool[] = [
  ...APP_TOOLS,
  ...KEYWORD_TOOLS,
  ...INSIGHT_TOOLS,
  ...ACTION_TOOLS,
];

export function toolByName(name: string): ReadTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name);
}
