import { z } from "zod";

export type QueryValue = string | number | boolean | undefined | null;

export interface ToolRequest {
  path: string;
  params?: Record<string, QueryValue>;
}

export const WRITE_METHODS = ["POST", "PATCH", "DELETE"] as const;

export type WriteMethod = (typeof WRITE_METHODS)[number];

export type JsonBody = Record<string, unknown>;

export interface WriteToolRequest extends ToolRequest {
  method: WriteMethod;
  body?: JsonBody;
}

export interface ResolvedRequest extends ToolRequest {
  method: "GET" | WriteMethod;
  body?: JsonBody;
}

export interface ReadToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<Shape>;
  request(input: z.infer<z.ZodObject<Shape>>): ToolRequest;
  unavailableOn404?: string;
}

export type ReadTool = ReadToolDefinition<z.ZodRawShape> & {
  readonly kind: "read";
};

export function defineReadTool<Shape extends z.ZodRawShape>(
  definition: ReadToolDefinition<Shape>,
): ReadTool {
  return { ...definition, kind: "read" };
}

export interface WriteToolHints {
  destructive: boolean;
  idempotent: boolean;
  openWorld: boolean;
}

export interface WriteToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<Shape>;
  hints: WriteToolHints;
  request(input: z.infer<z.ZodObject<Shape>>): WriteToolRequest;
  outcome(body: unknown, input: z.infer<z.ZodObject<Shape>>): unknown;
}

export type WriteTool = WriteToolDefinition<z.ZodRawShape> & {
  readonly kind: "write";
};

export function defineWriteTool<Shape extends z.ZodRawShape>(
  definition: WriteToolDefinition<Shape>,
): WriteTool {
  return { ...definition, kind: "write" };
}

export type McpTool = ReadTool | WriteTool;

const FOLDED_SEGMENTS = ["", ".", ".."];

export function seg(value: string): string {
  if (FOLDED_SEGMENTS.includes(value)) {
    throw new Error(`${JSON.stringify(value)} is not an id.`);
  }
  return encodeURIComponent(value);
}
