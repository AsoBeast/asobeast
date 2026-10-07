import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';

export interface ListedTool {
  name: string;
  description: string;
  annotations?: Record<string, unknown>;
}

export interface ToolResult {
  isError?: boolean;
  content?: { type: string; text: string }[];
}

export interface Envelope {
  result?: ToolResult & { tools?: ListedTool[] };
  error?: { code: number; message: string };
}

export function sseEnvelope(response: Response): Envelope {
  expect(response.headers['content-type']).toContain('text/event-stream');
  const frame = response.text
    .split('\n')
    .find((line) => line.startsWith('data: '));
  expect(frame).toBeDefined();
  return JSON.parse(frame!.slice('data: '.length)) as Envelope;
}

export function mcpAs(app: INestApplication<App>, token: string) {
  const rpc = (method: string, params: unknown = {}) =>
    request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method, params });

  return {
    rpc,
    listTools: async (): Promise<ListedTool[]> =>
      sseEnvelope(await rpc('tools/list').expect(200)).result?.tools ?? [],
    callTool: async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<Envelope> =>
      sseEnvelope(
        await rpc('tools/call', { name, arguments: args }).expect(200),
      ),
  };
}

export function textOf(envelope: Envelope): string {
  return envelope.result?.content?.[0]?.text ?? '';
}
