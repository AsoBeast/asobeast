import request from 'supertest';
import { createIsolationFixture, IsolationFixture } from './fixture';

interface ToolCallResult {
  result?: { content?: { text: string }[]; isError?: boolean };
}

function decode(body: string): ToolCallResult {
  const line = body
    .split('\n')
    .find((entry) => entry.startsWith('data: ') || entry.startsWith('{'));
  const payload = line?.startsWith('data: ') ? line.slice(6) : (line ?? body);
  return JSON.parse(payload) as ToolCallResult;
}

function payloadOf(body: string): unknown {
  const text = decode(body).result?.content?.[0].text ?? 'null';
  return JSON.parse(text);
}

describe('Remote MCP boundaries between workspaces', () => {
  let fixture: IsolationFixture;

  const callTool = (token: string, name: string, args: unknown = {}) =>
    request(fixture.app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      });

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it('lists only the apps of the workspace the token belongs to', async () => {
    const listed = await callTool(fixture.a.token, 'list_apps').expect(200);
    const apps = payloadOf(listed.text) as { id: string }[];

    const ids = apps.map((app) => app.id);
    expect(ids).toContain(fixture.a.appleAppId);
    expect(ids).not.toContain(fixture.b.appleAppId);
  });

  it('cannot read another workspace app through a tool', async () => {
    const response = await callTool(fixture.a.token, 'get_app', {
      appId: fixture.b.appleAppId,
    }).expect(200);

    expect(decode(response.text).result?.isError).toBe(true);
  });

  it('cannot read another workspace keywords through a tool', async () => {
    const response = await callTool(fixture.a.token, 'list_keywords', {
      appId: fixture.b.appleAppId,
    }).expect(200);

    expect(decode(response.text).result?.isError).toBe(true);
  });

  it('gives each token its own portfolio', async () => {
    const [forA, forB] = await Promise.all([
      callTool(fixture.a.token, 'portfolio').expect(200),
      callTool(fixture.b.token, 'portfolio').expect(200),
    ]);

    expect(payloadOf(forA.text)).not.toEqual(payloadOf(forB.text));
  });

  it('refuses an unknown token before any tool runs', async () => {
    await callTool('asob_not_a_real_token', 'list_apps').expect(401);
  });
});
