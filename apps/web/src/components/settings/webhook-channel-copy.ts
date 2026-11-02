import {
  isRetiredTeamsConnector,
  webhookChannelOf,
  webhookLabel,
  type WebhookChannel,
} from "@asobeast/shared";

export const WEBHOOK_CHANNEL_NAMES: Record<WebhookChannel, string> = {
  generic: "JSON webhook",
  discord: "Discord",
  slack: "Slack",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  google_chat: "Google Chat",
};

const SLACK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);
const RETIRED_CONNECTOR_HINT =
  'Office 365 connector urls stopped delivering in May 2026. Create a workflow with the "Send webhook alerts to a channel" template and paste its url.';

function parse(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

function genericHint(url: URL): string {
  if (SLACK_HOSTS.has(url.hostname)) {
    return "Recognised as a Slack workflow trigger. It receives the JSON payload; map its fields in Workflow Builder.";
  }
  if (url.pathname.includes("/webhook-test/")) {
    return "This is an n8n test url. It works only while the editor listens; use the production url.";
  }
  return "Recognised as a JSON webhook. It receives the documented payload.";
}

const CHANNEL_HINTS: Record<
  Exclude<WebhookChannel, "generic">,
  (url: URL) => string
> = {
  discord: () =>
    "Recognised as Discord. Reports arrive as embeds with the app icon.",
  slack: () => "Recognised as Slack. Reports arrive as Block Kit messages.",
  teams: () =>
    "Recognised as Microsoft Teams. Reports arrive as an Adaptive Card; Teams confirms acceptance, not delivery.",
  telegram: (url) =>
    url.searchParams.get("chat_id")
      ? "Recognised as Telegram. Reports arrive as a message from your bot."
      : "Recognised as Telegram. Add ?chat_id=<id> after sendMessage.",
  google_chat: () => "Recognised as Google Chat. Reports arrive as a card.",
};

export function channelHint(raw: string): string | null {
  const url = parse(raw);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return null;
  }
  if (isRetiredTeamsConnector(url.href)) return RETIRED_CONNECTOR_HINT;
  const channel = webhookChannelOf(url.href);
  return channel === "generic" ? genericHint(url) : CHANNEL_HINTS[channel](url);
}

export function deliversToChat(raw: string): boolean {
  const url = parse(raw);
  return url !== null && webhookChannelOf(url.href) !== "generic";
}

const isChatHost = (url: string): boolean => {
  const parsed = parse(url);
  return parsed !== null && SLACK_HOSTS.has(parsed.hostname);
};

export function webhookRowLabel(url: string, channel: WebhookChannel): string {
  return channel === "generic" && !isChatHost(url) ? url : webhookLabel(url);
}
