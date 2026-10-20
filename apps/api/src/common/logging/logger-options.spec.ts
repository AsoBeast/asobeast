import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import type { ConfigService } from '@nestjs/config';
import { pino, type Logger } from 'pino';
import type { Env } from '../../config/env';
import { WorkspaceContext } from '../tenancy/workspace-context';
import { REDACTED } from './log-redaction';
import { pinoHttp } from 'pino-http';
import { loggerParams, pinoOptions, secretLiterals } from './logger-options';

const AUTH_SECRET = '0123456789abcdef0123456789abcdef';

function configOf(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  const values: Record<string, unknown> = {
    NODE_ENV: 'production',
    LOG_LEVEL: 'debug',
    AUTH_SECRET,
    SMTP_PASSWORD: 'correct-horse-battery-staple',
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function collect(): { lines: unknown[]; stream: Writable } {
  const lines: unknown[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)));
      callback();
    },
  });
  return { lines, stream };
}

async function loggedLinesFor(path: string): Promise<string> {
  const workspace = new WorkspaceContext();
  const sink = collect();
  const { pinoHttp: options } = loggerParams(configOf(), workspace);
  const logging = pinoHttp({
    ...(options as object),
    logger: pino(pinoOptions(configOf(), workspace), sink.stream),
  });
  const server = createServer((req, res) => {
    logging(req, res);
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  await fetch(`http://127.0.0.1:${port}${path}`);
  await new Promise<void>((resolve) => server.close(() => resolve()));

  return JSON.stringify(sink.lines);
}

describe('pinoOptions', () => {
  let workspace: WorkspaceContext;
  let lines: Record<string, unknown>[];
  let logger: Logger;

  beforeEach(() => {
    workspace = new WorkspaceContext();
    const sink = collect();
    lines = sink.lines as Record<string, unknown>[];
    logger = pino(pinoOptions(configOf(), workspace), sink.stream);
  });

  it('carries the workspace and correlation id on every line inside a scope', async () => {
    await workspace.runScope(
      { workspaceId: 'ws_alpha', correlationId: 'corr-1' },
      () => {
        logger.info('daily run started');
        logger.warn('daily run degraded');
        return Promise.resolve();
      },
    );

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.workspaceId).toBe('ws_alpha');
      expect(line.correlationId).toBe('corr-1');
    }
  });

  it('carries an inherited correlation id into nested workspace scopes', async () => {
    await workspace.runScope(
      { workspaceId: 'ws_alpha', correlationId: 'corr-1' },
      () =>
        workspace.run('ws_beta', () => {
          logger.info('job started');
          return Promise.resolve();
        }),
    );

    expect(lines[0].workspaceId).toBe('ws_beta');
    expect(lines[0].correlationId).toBe('corr-1');
  });

  it('omits the workspace when nothing is in scope', () => {
    logger.info('bootstrap');
    expect(lines[0]).not.toHaveProperty('workspaceId');
  });

  it('scrubs configured secrets out of messages and merged objects', () => {
    logger.info({ token: 'asob_9f2c1a7b4e6d8c0a' }, `booted ${AUTH_SECRET}`);

    expect(JSON.stringify(lines[0])).not.toContain(AUTH_SECRET);
    expect(JSON.stringify(lines[0])).not.toContain('asob_9f2c1a7b4e6d8c0a');
    expect(lines[0].token).toBe(REDACTED);
  });

  it('scrubs secrets out of a serialized error', () => {
    logger.error({ err: new Error(`connect failed for ${AUTH_SECRET}`) });

    expect(JSON.stringify(lines[0])).not.toContain(AUTH_SECRET);
  });

  it('silences logs under the test environment', () => {
    const options = pinoOptions(configOf({ NODE_ENV: 'test' }), workspace);
    expect(options.level).toBe('silent');
  });

  it('renders human readable output in development', () => {
    const options = pinoOptions(
      configOf({ NODE_ENV: 'development' }),
      workspace,
    );
    expect(options.transport).toEqual({
      target: 'pino-pretty',
      options: { singleLine: true },
    });
  });
});

describe('secretLiterals', () => {
  it('collects only the configured secrets', () => {
    expect(secretLiterals(configOf())).toEqual([
      AUTH_SECRET,
      'correct-horse-battery-staple',
    ]);
  });
});

describe('loggerParams', () => {
  it('logs a request without an api token held by any query parameter', async () => {
    const token = 'asob_0123456789abcdef0123456789abcdef0123456789abcdef';
    const workspace = new WorkspaceContext();
    const sink = collect();
    const { pinoHttp: options } = loggerParams(configOf(), workspace);
    const logging = pinoHttp({
      ...(options as object),
      logger: pino(pinoOptions(configOf(), workspace), sink.stream),
    });
    const server = createServer((req, res) => {
      logging(req, res);
      res.statusCode = 401;
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await fetch(`http://127.0.0.1:${port}/mcp?key=${token}`, {
      method: 'POST',
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const logged = JSON.stringify(sink.lines);
    expect(logged).toContain('/mcp');
    expect(logged).not.toContain(token);
  });

  it('logs a request without the token in its address or query', async () => {
    const token = 'hUvkXqhz7DN47i7KZ5KzkF-cXu_Sh49XWB2Dyapx-r0';
    const workspace = new WorkspaceContext();
    const sink = collect();
    const { pinoHttp: options } = loggerParams(configOf(), workspace);
    const logging = pinoHttp({
      ...(options as object),
      logger: pino(pinoOptions(configOf(), workspace), sink.stream),
    });
    const server = createServer((req, res) => {
      logging(req, res);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await fetch(
      `http://127.0.0.1:${port}/email-alerts/ea_1/unsubscribe?token=${token}`,
      { method: 'POST' },
    );
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const logged = JSON.stringify(sink.lines);
    expect(logged).toContain('/email-alerts/ea_1/unsubscribe');
    expect(logged).not.toContain(token);
  });

  it('logs a request url without the secret values of its query string', async () => {
    const logged = await loggedLinesFor(
      '/no-such-route?token=asob_EXAMPLE&password=hunter2hunter2&access_token=ACCTOKMARKER&api_key=APIKEYMARKER&secret=SECRETMARK2&country=us',
    );

    expect(logged).toContain(
      '/no-such-route?token=[redacted]&password=[redacted]&access_token=[redacted]&api_key=[redacted]&secret=[redacted]&country=us',
    );
    for (const value of [
      'asob_EXAMPLE',
      'hunter2hunter2',
      'ACCTOKMARKER',
      'APIKEYMARKER',
      'SECRETMARK2',
    ]) {
      expect(logged).not.toContain(value);
    }
  });
});
