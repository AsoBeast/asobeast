import type { ApiErrorEnvelope } from '@asobeast/shared';
import type { ReadTool } from '@asobeast/mcp-tools';
import type { InProcessResponse } from './in-process.gateway';

const UNAUTHENTICATED =
  'The API token was rejected. It is missing, revoked or expired, so retrying will not help. Ask the account owner for a fresh token from Settings.';

function envelopeOf(body: unknown): Partial<ApiErrorEnvelope> {
  return typeof body === 'object' && body !== null ? body : {};
}

function messageOf(
  envelope: Partial<ApiErrorEnvelope>,
  status: number,
): string {
  return typeof envelope.message === 'string'
    ? envelope.message
    : `The asobeast API answered ${status}.`;
}

export function toolErrorText(
  tool: ReadTool,
  response: InProcessResponse,
): string {
  const envelope = envelopeOf(response.body);
  const message = messageOf(envelope, response.status);

  if (response.status === 401) return UNAUTHENTICATED;
  if (response.status === 404 && tool.unavailableOn404) {
    return tool.unavailableOn404;
  }
  if (response.status === 402 && envelope.entitlement) {
    return `${message} Retrying will not help until someone starts a plan at ${envelope.entitlement.upgradePath}.`;
  }
  if (response.status === 403) {
    return `${message} This is an account state rather than a transient failure, so retrying will not help.`;
  }
  if (response.status === 429 && envelope.rateLimit) {
    return `${message} Report this to the user rather than retrying in a loop.`;
  }
  return message;
}
