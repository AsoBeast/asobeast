import type { McpTool, ResolvedRequest } from "./define";
import { toolText } from "./tool-text";

export interface ToolAnnotationHints {
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export const UNCERTAIN_OUTCOME_NOTE =
  "The change may or may not have been applied. Read the current state before retrying.";

export function annotationsOf(tool: McpTool): ToolAnnotationHints {
  if (tool.kind === "read") return { readOnlyHint: true };
  return {
    readOnlyHint: false,
    destructiveHint: tool.hints.destructive,
    idempotentHint: tool.hints.idempotent,
    openWorldHint: tool.hints.openWorld,
  };
}

export function requestOf(
  tool: McpTool,
  input: Record<string, unknown>,
): ResolvedRequest {
  if (tool.kind === "write") return tool.request(input);
  return { method: "GET", ...tool.request(input) };
}

export function toolOutput(
  tool: McpTool,
  input: Record<string, unknown>,
  body: unknown,
): string {
  return toolText(tool.kind === "write" ? tool.outcome(body, input) : body);
}

function isUnknownOutcome(status: number): boolean {
  const unreadableSuccess = status >= 200 && status < 300;
  return status === 0 || unreadableSuccess || status >= 500;
}

export function withOutcomeNote(
  tool: McpTool,
  status: number,
  message: string,
): string {
  const unknownOutcome = tool.kind === "write" && isUnknownOutcome(status);
  return unknownOutcome ? `${message} ${UNCERTAIN_OUTCOME_NOTE}` : message;
}
