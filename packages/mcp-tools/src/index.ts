import type { ApiTokenScope } from "@asobeast/shared";
import { ACTION_TOOLS } from "./actions";
import { APP_TOOLS } from "./apps";
import { COMPETITOR_TOOLS } from "./competitors";
import { INSIGHT_TOOLS } from "./insights";
import { KEYWORD_TOOLS } from "./keywords";
import { MCP_WRITE_TOOLS } from "./write-tools";
import type { McpTool, ReadTool } from "./define";

export * from "./define";
export {
  UNCERTAIN_OUTCOME_NOTE,
  annotationsOf,
  requestOf,
  toolOutput,
  withOutcomeNote,
  type ToolAnnotationHints,
} from "./tool-call";
export { toolText } from "./tool-text";
export { notFoundText } from "./not-found";
export { ACTION_TOOLS } from "./actions";
export { APP_TOOLS } from "./apps";
export { COMPETITOR_TOOLS } from "./competitors";
export { INSIGHT_TOOLS } from "./insights";
export { KEYWORD_TOOLS } from "./keywords";
export { MCP_WRITE_TOOLS, TRACK_KEYWORDS_LIMIT } from "./write-tools";

export const MCP_TOOLS: ReadTool[] = [
  ...APP_TOOLS,
  ...KEYWORD_TOOLS,
  ...COMPETITOR_TOOLS,
  ...INSIGHT_TOOLS,
  ...ACTION_TOOLS,
];

export function toolByName(name: string): ReadTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name);
}

export function toolsFor(scope: ApiTokenScope): McpTool[] {
  return scope === "write"
    ? [...MCP_TOOLS, ...MCP_WRITE_TOOLS]
    : [...MCP_TOOLS];
}
