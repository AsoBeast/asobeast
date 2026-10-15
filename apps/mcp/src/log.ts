import { API_TOKEN_PREFIX, redactUrlCredentials } from "@asobeast/shared";

const REDACTED = "[redacted]";

const API_TOKEN = new RegExp(`${API_TOKEN_PREFIX}[A-Za-z0-9_-]{8,}`, "g");

function redact(message: string): string {
  return redactUrlCredentials(message.replace(API_TOKEN, REDACTED), REDACTED);
}

export function logError(message: string): void {
  process.stderr.write(`[asobeast-mcp] ${redact(message)}\n`);
}

export function logInfo(message: string): void {
  process.stderr.write(`[asobeast-mcp] ${redact(message)}\n`);
}
