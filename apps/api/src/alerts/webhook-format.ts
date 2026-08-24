import {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertBatchScope,
  AlertPayload,
  DigestWeeklyPayload,
  SERP_DEPTH,
  keywordLabel,
} from '@asobeast/shared';
import {
  actionLine,
  AlertBatchBlock,
  appHeader,
  appLabel,
  changeLines,
  position,
  sectionBlocks,
  stars,
  storeLabel,
} from './alert-summary';

const DIGEST_APP_CAP = 10;
const BATCH_APP_CAP = 10;
const DISCORD_FIELD_MAX = 1000;
const DISCORD_TOTAL_MAX = 6000;
const DISCORD_NAME_MAX = 256;
const SLACK_SECTION_MAX = 2900;
const SLACK_TOTAL_MAX = 30_000;

function host(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isDiscord(url: string): boolean {
  const name = host(url);
  return name === 'discord.com' || name === 'discordapp.com';
}

function isSlack(url: string): boolean {
  return host(url) === 'hooks.slack.com';
}

export function renderMessage(payload: AlertPayload): string {
  if (payload.event === 'metadata.changed') {
    const who = payload.app.name ?? 'An app';
    const tag = payload.app.isCompetitor ? ' (competitor)' : '';
    const fields = payload.changes.map((change) => change.field).join(', ');
    return `📝 ${who}${tag} changed: ${fields}`;
  }

  if (payload.event === 'review.negative') {
    const who = payload.app.name ?? 'An app';
    const version = payload.review.version
      ? ` (v${payload.review.version})`
      : '';
    return `⚠️ ${who} got a ${stars(payload.review.score)} review${version}: "${payload.review.text}"`;
  }

  if (payload.event === 'digest.weekly') {
    return `🗓️ Weekly digest: ${payload.apps.length} app${payload.apps.length === 1 ? '' : 's'}`;
  }

  if (payload.event === 'serp.entrant') {
    const names = payload.entrants
      .map((entrant) => `${position(entrant.position)} ${entrant.title}`)
      .join(', ');
    return `🆕 New in the top ${SERP_DEPTH} for "${keywordLabel(payload.keyword)}": ${names}`;
  }

  if (payload.event === 'alerts.batch') {
    return batchFormatter(payload).headline(payload);
  }

  if (payload.event === 'action.opened') {
    return `🎯 ${actionLine(payload)}`;
  }

  const who = payload.app.name ?? 'An app';
  const icon = payload.event === 'rank.dropped' ? '📉' : '📈';
  const verb = payload.event === 'rank.dropped' ? 'dropped' : 'improved';
  return `${icon} ${who} ${verb} for "${keywordLabel(payload.keyword)}": ${position(payload.from, payload.fromDepth)} → ${position(payload.to, payload.toDepth)}`;
}

function signedDelta(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const rounded = Math.round(value * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function digestTitle(payload: DigestWeeklyPayload): string {
  return `🗓️ Weekly digest · ${payload.window.from} → ${payload.window.to}`;
}

function digestAppLine(app: DigestWeeklyPayload['apps'][number]): string {
  const parts = [
    `${app.name ?? 'App'} — vis ${Math.round(app.visibility.current)} (${signedDelta(app.visibility.delta7d)})`,
  ];
  const up = app.moversUp[0];
  if (up) {
    parts.push(
      `↑ ${up.text} ${position(up.from, up.fromDepth)}→${position(up.to, up.toDepth)}`,
    );
  }
  const down = app.moversDown[0];
  if (down) {
    parts.push(
      `↓ ${down.text} ${position(down.from, down.fromDepth)}→${position(down.to, down.toDepth)}`,
    );
  }
  parts.push(`${app.changes} change${app.changes === 1 ? '' : 's'}`);
  if (app.actions) {
    parts.push(
      `${app.actions.open} open action${app.actions.open === 1 ? '' : 's'}`,
    );
  }
  return parts.join(' · ');
}

function digestLines(payload: DigestWeeklyPayload): string[] {
  const lines = payload.apps.slice(0, DIGEST_APP_CAP).map(digestAppLine);
  if (payload.apps.length > DIGEST_APP_CAP) {
    lines.push(`+${payload.apps.length - DIGEST_APP_CAP} more`);
  }
  return lines;
}

function digestDiscordBody(payload: DigestWeeklyPayload): unknown {
  return {
    embeds: [
      {
        title: digestTitle(payload),
        description: digestLines(payload).join('\n'),
      },
    ],
  };
}

function digestSlackBody(payload: DigestWeeklyPayload): unknown {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: digestTitle(payload) },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: digestLines(payload).join('\n') },
      },
    ],
  };
}

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

interface BatchGroup {
  name: string;
  blocks: AlertBatchBlock[];
}

interface BatchFormatter {
  headline: (payload: AlertBatchPayload) => string;
  group: (section: AlertBatchAppSection) => BatchGroup;
  omittedNoun: string;
}

function competitorBlocks(section: AlertBatchAppSection): AlertBatchBlock[] {
  return section.competitors.map((competitor) => ({
    title: `Competitor · ${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)} · ${competitor.app.country.toUpperCase()}`,
    lines: competitor.changes.flatMap(changeLines),
  }));
}

const BATCH_FORMATTERS: Record<AlertBatchScope, BatchFormatter> = {
  owned_apps: {
    headline: (payload) =>
      `📊 Daily app update · ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'app')}`,
    group: (section) => ({
      name: appHeader(section),
      blocks: sectionBlocks(section),
    }),
    omittedNoun: 'app group',
  },
  competitors: {
    headline: (payload) =>
      `🔭 Competitor watch · ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'competitor')}`,
    group: (section) => ({
      name: `Primary app · ${appHeader(section)}`,
      blocks: competitorBlocks(section),
    }),
    omittedNoun: 'primary app group',
  },
};

const LEGACY_BATCH_FORMATTER: BatchFormatter = {
  headline: (payload) =>
    `📊 Daily alert update · ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'app')}`,
  group: (section) => ({
    name: appHeader(section),
    blocks: [...sectionBlocks(section), ...competitorBlocks(section)],
  }),
  omittedNoun: 'app group',
};

function batchFormatter(payload: AlertBatchPayload): BatchFormatter {
  if (payload.scope === 'owned_apps') return BATCH_FORMATTERS.owned_apps;
  if (payload.scope === 'competitors') return BATCH_FORMATTERS.competitors;
  return LEGACY_BATCH_FORMATTER;
}

function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_~])/g, '\\$1');
}

function escapeDiscord(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|<>~@])/g, '\\$1');
}

function shortenLine(text: string, max: number): string {
  if (text.length <= max) return text;
  let visible = Math.max(0, max - 24);
  let suffix = '';
  for (;;) {
    suffix = `… (+${text.length - visible} chars omitted)`;
    const next = Math.max(0, max - suffix.length);
    if (next === visible) break;
    visible = next;
  }
  return `${text.slice(0, visible)}${suffix}`;
}

function boundedLines(lines: string[], max: number): string {
  if (lines.length === 0) return '';
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = shortenLine(lines[index], max);
    const remaining = lines.length - index - 1;
    const note = remaining > 0 ? `+${remaining} more lines` : '';
    const candidate = [...output, line, note].filter(Boolean).join('\n');
    if (candidate.length <= max) {
      output.push(line);
      continue;
    }
    if (output.length === 0) {
      const available = note ? max - note.length - 1 : max;
      output.push(shortenLine(line, available));
      if (note) output.push(note);
      break;
    }
    const omission = `+${lines.length - index} more lines`;
    if ([...output, omission].join('\n').length <= max) output.push(omission);
    break;
  }
  return output.join('\n');
}

function renderGroup(
  group: BatchGroup,
  escape: (text: string) => string,
  bold: (text: string) => string,
  max: number,
): string {
  const lines = group.blocks.flatMap((block) => [
    bold(escape(block.title)),
    ...block.lines.map(escape),
  ]);
  return boundedLines(lines, max);
}

function omittedLine(
  total: number,
  shown: number,
  noun: string,
): string | null {
  const count = total - shown;
  return count > 0 ? `+${count} more ${noun}${count === 1 ? '' : 's'}` : null;
}

function batchWindow(payload: AlertBatchPayload): string {
  return `Window (UTC) ${payload.window.from} → ${payload.window.to}`;
}

function batchDiscordBody(payload: AlertBatchPayload): unknown {
  const formatter = batchFormatter(payload);
  const title = clamp(formatter.headline(payload), DISCORD_NAME_MAX);
  const description = escapeDiscord(batchWindow(payload));
  const fields: { name: string; value: string }[] = [];
  let used = title.length + description.length;
  for (const section of payload.apps.slice(0, BATCH_APP_CAP)) {
    const group = formatter.group(section);
    const name = clamp(escapeDiscord(group.name), DISCORD_NAME_MAX);
    const value = renderGroup(
      group,
      escapeDiscord,
      (text) => `**${text}**`,
      DISCORD_FIELD_MAX,
    );
    if (value.length === 0) continue;
    if (used + name.length + value.length > DISCORD_TOTAL_MAX) break;
    fields.push({ name, value });
    used += name.length + value.length;
  }
  let more = omittedLine(
    payload.apps.length,
    fields.length,
    formatter.omittedNoun,
  );
  while (
    more &&
    used + 1 + more.length > DISCORD_TOTAL_MAX &&
    fields.length > 0
  ) {
    const removed = fields.pop();
    if (removed) used -= removed.name.length + removed.value.length;
    more = omittedLine(
      payload.apps.length,
      fields.length,
      formatter.omittedNoun,
    );
  }
  if (more) {
    fields.push({ name: '…', value: more });
  }
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title,
        description,
        fields,
      },
    ],
  };
}

function batchSlackBody(payload: AlertBatchPayload): unknown {
  const formatter = batchFormatter(payload);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: clamp(formatter.headline(payload), 150),
      },
    },
  ];
  let used = 0;
  let shown = 0;
  for (const section of payload.apps.slice(0, BATCH_APP_CAP)) {
    const group = formatter.group(section);
    const detail = renderGroup(
      group,
      escapeSlack,
      (text) => `*${text}*`,
      SLACK_SECTION_MAX,
    );
    if (detail.length === 0) continue;
    const text = boundedLines(
      [`*${escapeSlack(group.name)}*`, ...detail.split('\n')],
      SLACK_SECTION_MAX,
    );
    if (used + text.length > SLACK_TOTAL_MAX) break;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
    used += text.length;
    shown += 1;
  }
  const more = omittedLine(payload.apps.length, shown, formatter.omittedNoun);
  if (more) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: more },
    });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: escapeSlack(batchWindow(payload)) }],
  });
  return { blocks };
}

export function formatWebhookBody(url: string, payload: AlertPayload): string {
  if (payload.event === 'alerts.batch') {
    if (isDiscord(url)) {
      return JSON.stringify(batchDiscordBody(payload));
    }
    if (isSlack(url)) {
      return JSON.stringify(batchSlackBody(payload));
    }
    return JSON.stringify(payload);
  }
  if (payload.event === 'digest.weekly') {
    if (isDiscord(url)) {
      return JSON.stringify(digestDiscordBody(payload));
    }
    if (isSlack(url)) {
      return JSON.stringify(digestSlackBody(payload));
    }
    return JSON.stringify(payload);
  }
  if (isDiscord(url)) {
    return JSON.stringify({ content: renderMessage(payload) });
  }
  if (isSlack(url)) {
    return JSON.stringify({ text: renderMessage(payload) });
  }
  return JSON.stringify(payload);
}
