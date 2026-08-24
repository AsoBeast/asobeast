import { z } from "zod";

export type QueryValue = string | number | boolean | undefined | null;

export interface ToolRequest {
  path: string;
  params?: Record<string, QueryValue>;
}

export interface ReadToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<Shape>;
  request(input: z.infer<z.ZodObject<Shape>>): ToolRequest;
  unavailableOn404?: string;
}

export type ReadTool = ReadToolDefinition<z.ZodRawShape>;

export function defineReadTool<Shape extends z.ZodRawShape>(
  definition: ReadToolDefinition<Shape>,
): ReadTool {
  return definition;
}

export function seg(value: string): string {
  return encodeURIComponent(value);
}
