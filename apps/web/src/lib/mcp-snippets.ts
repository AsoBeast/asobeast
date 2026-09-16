export const STDIO_ENTRYPOINT =
  "/absolute/path/to/asobeast/apps/mcp/dist/index.js";

const MCP_REMOTE_PACKAGE = "mcp-remote@0.14.2";
const MCP_REMOTE_PLAIN_HTTP_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const MCP_CLIENTS = [
  "Claude Code",
  "Claude Desktop",
  "Codex",
  "Cursor",
  "VS Code",
  "Gemini CLI",
  "Windsurf",
  "Other",
] as const;

export type McpClient = (typeof MCP_CLIENTS)[number];

export type SnippetLanguage = "bash" | "json";

export interface ConnectSnippet {
  id: string;
  client: McpClient;
  label: string;
  location: string;
  language: SnippetLanguage;
  value: string;
}

export function apiOrigin(origin?: string): string {
  const base =
    origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/api/backend`;
}

export function remoteEndpoint(origin?: string): string {
  return `${apiOrigin(origin)}/mcp`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function mcpServersFile(entry: unknown): string {
  return json({ mcpServers: { asobeast: entry } });
}

function claudeCodeEntry(authorization: string, endpoint: string) {
  return {
    type: "http",
    url: endpoint,
    headers: { Authorization: authorization },
  };
}

function needsAllowHttp(endpoint: string): boolean {
  const { protocol, hostname } = new URL(endpoint);
  return protocol === "http:" && !MCP_REMOTE_PLAIN_HTTP_HOSTS.has(hostname);
}

function claudeDesktopEntry(token: string, endpoint: string) {
  return {
    command: "npx",
    args: [
      "-y",
      MCP_REMOTE_PACKAGE,
      endpoint,
      ...(needsAllowHttp(endpoint) ? ["--allow-http"] : []),
      "--header",
      "Authorization:${ASOBEAST_AUTH_HEADER}",
    ],
    env: { ASOBEAST_AUTH_HEADER: `Bearer ${token}` },
  };
}

export function hostedSnippets(
  token: string,
  origin?: string,
): ConnectSnippet[] {
  const endpoint = remoteEndpoint(origin);
  return [
    {
      id: "claude-code-command",
      client: "Claude Code",
      label: "Claude Code",
      location: "Run in a terminal",
      language: "bash",
      value: `claude mcp add --transport http asobeast ${endpoint} --header "Authorization: Bearer ${token}"`,
    },
    {
      id: "claude-code-add-json",
      client: "Claude Code",
      label: "Claude Code JSON",
      location: "Run in a macOS or Linux terminal",
      language: "bash",
      value: `claude mcp add-json asobeast '${JSON.stringify(claudeCodeEntry(`Bearer ${token}`, endpoint))}'`,
    },
    {
      id: "claude-code-project",
      client: "Claude Code",
      label: "Shared .mcp.json",
      location:
        ".mcp.json in the project root. Export ASOBEAST_API_TOKEN before starting claude; the file holds no secret",
      language: "json",
      value: mcpServersFile(
        claudeCodeEntry("Bearer ${ASOBEAST_API_TOKEN}", endpoint),
      ),
    },
    {
      id: "claude-desktop",
      client: "Claude Desktop",
      label: "Claude Desktop",
      location:
        "claude_desktop_config.json (Settings, Developer, Edit Config). Merge into an existing mcpServers object. Needs Node 18 or newer",
      language: "json",
      value: mcpServersFile(claudeDesktopEntry(token, endpoint)),
    },
  ];
}

export function localSnippets(
  token: string,
  origin?: string,
): ConnectSnippet[] {
  const api = apiOrigin(origin);
  return [
    {
      id: "claude-code-stdio",
      client: "Claude Code",
      label: "Claude Code stdio",
      location:
        "Run in a terminal. Replace the path with the absolute path to apps/mcp/dist/index.js",
      language: "bash",
      value: `claude mcp add asobeast --env ASOBEAST_API_URL=${api} --env ASOBEAST_API_TOKEN=${token} -- node ${STDIO_ENTRYPOINT}`,
    },
    {
      id: "claude-desktop-stdio",
      client: "Claude Desktop",
      label: "Claude Desktop stdio config",
      location:
        "claude_desktop_config.json. Replace the path, and use the absolute path to node if Claude Desktop cannot find it",
      language: "json",
      value: mcpServersFile({
        command: "node",
        args: [STDIO_ENTRYPOINT],
        env: { ASOBEAST_API_URL: api, ASOBEAST_API_TOKEN: token },
      }),
    },
  ];
}

export function snippetById(
  snippets: ConnectSnippet[],
  id: string,
): ConnectSnippet {
  const snippet = snippets.find((candidate) => candidate.id === id);
  if (!snippet) throw new Error(`no connect snippet named ${id}`);
  return snippet;
}

export function snippetsFor(
  snippets: ConnectSnippet[],
  client: McpClient,
): ConnectSnippet[] {
  return snippets.filter((snippet) => snippet.client === client);
}
