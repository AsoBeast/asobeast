import type { ApiTokenScope } from "@asobeast/shared";
import { ACTION_TOOLS } from "./actions";
import { ANNOTATION_TOOLS, ANNOTATION_WRITE_TOOLS } from "./annotations";
import { APP_TOOLS } from "./apps";
import { CHART_TOOLS } from "./charts";
import { COMPETITOR_TOOLS } from "./competitors";
import { INSIGHT_TOOLS } from "./insights";
import { KEYWORD_TOOLS } from "./keywords";
import { MCP_WRITE_TOOLS as CORE_WRITE_TOOLS } from "./write-tools";
import type { McpTool, ReadTool, WriteTool } from "./define";

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
export { ANNOTATION_TOOLS, ANNOTATION_WRITE_TOOLS } from "./annotations";
export { APP_TOOLS } from "./apps";
export { CHART_TOOLS } from "./charts";
export { COMPETITOR_TOOLS } from "./competitors";
export { INSIGHT_TOOLS } from "./insights";
export { KEYWORD_TOOLS } from "./keywords";
export { TRACK_KEYWORDS_LIMIT } from "./write-tools";

export const MCP_WRITE_TOOLS: WriteTool[] = [
  ...CORE_WRITE_TOOLS,
  ...ANNOTATION_WRITE_TOOLS,
];

export const MCP_TOOLS: ReadTool[] = [
  ...APP_TOOLS,
  ...KEYWORD_TOOLS,
  ...COMPETITOR_TOOLS,
  ...CHART_TOOLS,
  ...ANNOTATION_TOOLS,
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
