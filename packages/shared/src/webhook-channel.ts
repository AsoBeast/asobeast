export const WEBHOOK_CHANNELS = [
  'generic',
  'discord',
  'slack',
  'teams',
  'telegram',
  'google_chat',
] as const;
export type WebhookChannel = (typeof WEBHOOK_CHANNELS)[number];

const DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'ptb.discord.com',
  'canary.discord.com',
]);
const SLACK_HOSTS = new Set(['hooks.slack.com', 'hooks.slack-gov.com']);
const TEAMS_SUFFIXES = [
  '.logic.azure.com',
  '.powerplatform.com',
  '.webhook.office.com',
];

const DISCORD_PATH = /^\/api(\/v\d+)?\/webhooks\/\d+\/[^/]+/;
const TELEGRAM_PATH = /^\/bot[^/]+\/sendMessage$/;
const GOOGLE_CHAT_PATH = /^\/v1\/spaces\/[^/]+\/messages$/;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function webhookChannelOf(url: string): WebhookChannel {
  const parsed = parse(url);
  if (!parsed) return 'generic';
  const host = parsed.hostname;
  const path = parsed.pathname;
  if (DISCORD_HOSTS.has(host) && DISCORD_PATH.test(path)) return 'discord';
  if (SLACK_HOSTS.has(host) && path.startsWith('/services/')) return 'slack';
  if (TEAMS_SUFFIXES.some((suffix) => host.endsWith(suffix))) return 'teams';
  if (host === 'api.telegram.org' && TELEGRAM_PATH.test(path)) {
    return 'telegram';
  }
  if (host === 'chat.googleapis.com' && GOOGLE_CHAT_PATH.test(path)) {
    return 'google_chat';
  }
  return 'generic';
}
