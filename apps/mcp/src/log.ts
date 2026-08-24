import { API_TOKEN_PREFIX } from "@asobeast/shared";

const REDACTED = "[redacted]";

const SECRET_SHAPES: [RegExp, string][] = [
  [new RegExp(`${API_TOKEN_PREFIX}[A-Za-z0-9_-]{8,}`, "g"), REDACTED],
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`],
];

function redact(message: string): string {
  let redacted = message;
  for (const [shape, replacement] of SECRET_SHAPES) {
    redacted = redacted.replace(shape, replacement);
  }
  return redacted;
}

export function logError(message: string): void {
  process.stderr.write(`[asobeast-mcp] ${redact(message)}\n`);
}

export function logInfo(message: string): void {
  process.stderr.write(`[asobeast-mcp] ${redact(message)}\n`);
}
