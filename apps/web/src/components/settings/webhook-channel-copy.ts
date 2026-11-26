import {
  isRetiredTeamsConnector,
  webhookChannelOf,
  webhookLabel,
  type WebhookChannel,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

const PROVIDER_NAMES: Record<Exclude<WebhookChannel, "generic">, string> = {
  discord: "Discord",
  slack: "Slack",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  google_chat: "Google Chat",
};

export function webhookChannelName(
  channel: WebhookChannel,
  translator: MessageTranslator,
): string {
  return channel === "generic"
    ? translator("channels.generic")
    : PROVIDER_NAMES[channel];
}

const SLACK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);

function parse(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

function genericHint(url: URL, translator: MessageTranslator): string {
  if (SLACK_HOSTS.has(url.hostname)) {
    return translator("hints.slackWorkflow");
  }
  if (url.pathname.includes("/webhook-test/")) {
    return translator("hints.n8nTest");
  }
  return translator("hints.generic");
}

const CHANNEL_HINTS: Record<
  Exclude<WebhookChannel, "generic">,
  (url: URL, translator: MessageTranslator) => string
> = {
  discord: (_url, translator) => translator("hints.discord"),
  slack: (_url, translator) => translator("hints.slack"),
  teams: (_url, translator) => translator("hints.teams"),
  telegram: (url, translator) =>
    translator(
      url.searchParams.get("chat_id")
        ? "hints.telegramReady"
        : "hints.telegramMissingChat",
      { id: "<id>" },
    ),
  google_chat: (_url, translator) => translator("hints.googleChat"),
};

export function channelHint(
  raw: string,
  translator: MessageTranslator,
): string | null {
  const url = parse(raw);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return null;
  }
  if (isRetiredTeamsConnector(url.href))
    return translator("hints.retiredTeams");
  const channel = webhookChannelOf(url.href);
  return channel === "generic"
    ? genericHint(url, translator)
    : CHANNEL_HINTS[channel](url, translator);
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
