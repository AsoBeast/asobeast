export const STDIO_ENTRYPOINT =
  "/absolute/path/to/asobeast/apps/mcp/dist/index.js";

export type SnippetLanguage = "bash" | "json";

export interface ConnectSnippet {
  id: string;
  client: string;
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
      location: "",
      language: "bash",
      value: `claude mcp add --transport http asobeast ${endpoint} --header "Authorization: Bearer ${token}"`,
    },
    {
      id: "claude-code-add-json",
      client: "Claude Code",
      label: "Add from JSON",
      location: "Run in a macOS or Linux terminal",
      language: "bash",
      value: `claude mcp add-json asobeast '${JSON.stringify(claudeCodeEntry(`Bearer ${token}`, endpoint))}'`,
    },
    {
      id: "claude-code-project",
      client: "Claude Code",
      label: "Share with your team",
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
      label: "Claude Desktop config",
      location: "",
      language: "json",
      value: mcpServersFile(claudeCodeEntry(`Bearer ${token}`, endpoint)),
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
      location: "",
      language: "bash",
      value: `claude mcp add asobeast --env ASOBEAST_API_URL=${api} --env ASOBEAST_API_TOKEN=${token} -- node ${STDIO_ENTRYPOINT}`,
    },
    {
      id: "claude-desktop-stdio",
      client: "Claude Desktop",
      label: "Claude Desktop stdio config",
      location: "",
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
