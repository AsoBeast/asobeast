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
const LEGACY_TEAMS_SUFFIX = '.webhook.office.com';
const LEGACY_OUTLOOK_HOST = 'outlook.office.com';

const DISCORD_PATH = /^\/(api(?:\/v\d+)?\/webhooks\/\d+)\/[^/]+/;
const SLACK_IDS = /^\/services\/([^/]+\/[^/]+)\//;
const TEAMS_WORKFLOW = /\/workflows\/([^/]+)\//;
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

export function isRetiredTeamsConnector(url: string): boolean {
  const parsed = parse(url);
  if (!parsed) return false;
  return (
    parsed.hostname.endsWith(LEGACY_TEAMS_SUFFIX) ||
    (parsed.hostname === LEGACY_OUTLOOK_HOST &&
      parsed.pathname.startsWith('/webhook/'))
  );
}

const HIDDEN = '…';

const withHidden = (prefix: string | undefined): string =>
  prefix ? `${prefix}/${HIDDEN}` : HIDDEN;

function telegramPath(url: URL): string {
  const chat = url.searchParams.get('chat_id');
  return `bot${HIDDEN}/sendMessage${chat ? `?chat_id=${chat}` : ''}`;
}

function channelPath(url: URL): string | null {
  const path = url.pathname;
  switch (webhookChannelOf(url.href)) {
    case 'discord':
      return withHidden(DISCORD_PATH.exec(path)?.[1]);
    case 'slack':
      return `services/${withHidden(SLACK_IDS.exec(path)?.[1])}`;
    case 'teams': {
      const workflow = TEAMS_WORKFLOW.exec(path)?.[1];
      return withHidden(workflow && `workflows/${workflow}`);
    }
    case 'telegram':
      return telegramPath(url);
    case 'google_chat':
      return path.slice(1);
    default:
      return path === '/' ? null : HIDDEN;
  }
}

export function webhookLabel(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'an invalid url';
  }
  const path = channelPath(url);
  return path ? `${url.host}/${path}` : url.host;
}
