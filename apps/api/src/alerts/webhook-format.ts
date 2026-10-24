import type {
  AlertBatchPayload,
  AlertPayload,
  DigestWeeklyPayload,
} from '@asobeast/shared';
import type { AlertReport, ReportApp } from './report/report';
import { buildAlert } from './report/build-alert';
import { buildReport } from './report/build-report';
import { blocksOf, moreApps, type ReportBlock } from './report/report-blocks';
import type { GranularPayload } from './report/report-sentences';
import { identityLine } from './report/storefront';

const DISCORD_FIELD_MAX = 1000;
const DISCORD_TOTAL_MAX = 6000;
const DISCORD_NAME_MAX = 256;
const SLACK_HEADER_MAX = 150;
const SLACK_SECTION_MAX = 2900;
const SLACK_TOTAL_MAX = 30_000;
const NO_MENTIONS = { parse: [] };

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

const headlineOf = (report: AlertReport): string =>
  `${report.emoji} ${report.headline}`;

export function renderMessage(payload: GranularPayload): string {
  return headlineOf(buildAlert(payload, null));
}

function factLines(report: AlertReport): string[] {
  return report.facts.map(({ label, value }) =>
    label ? `${label}: ${value}` : value,
  );
}

function digestDiscordBody(payload: DigestWeeklyPayload): unknown {
  const report = buildAlert(payload, null);
  return {
    allowed_mentions: NO_MENTIONS,
    embeds: [
      {
        title: clamp(headlineOf(report), DISCORD_NAME_MAX),
        description: factLines(report).map(escapeDiscord).join('\n'),
      },
    ],
  };
}

function digestSlackBody(payload: DigestWeeklyPayload): unknown {
  const report = buildAlert(payload, null);
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: clamp(headlineOf(report), SLACK_HEADER_MAX),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: factLines(report).map(escapeSlack).join('\n'),
        },
      },
    ],
  };
}

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface ChatGroup {
  name: string;
  blocks: ReportBlock[];
}

function chatGroup(app: ReportApp): ChatGroup {
  const subtitle = identityLine(app, true);
  return {
    name: subtitle ? `${app.identity.name} · ${subtitle}` : app.identity.name,
    blocks: blocksOf(app),
  };
}

function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_~])/g, '\\$1');
}

function escapeDiscord(text: string): string {
  return text.replace(/([\\`*_~|>@])/g, '\\$1');
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
    const note = remaining > 0 ? `+${remaining} more` : '';
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
    const omission = `+${lines.length - index} more`;
    if ([...output, omission].join('\n').length <= max) output.push(omission);
    break;
  }
  return output.join('\n');
}

function renderGroup(
  group: ChatGroup,
  escape: (text: string) => string,
  bold: (text: string) => string,
  max: number,
): string {
  const lines = group.blocks.flatMap((block) => [
    ...(block.title ? [bold(escape(block.title))] : []),
    ...block.lines.map(escape),
  ]);
  return boundedLines(lines, max);
}

function omittedLine(total: number, shown: number): string | null {
  const count = total - shown;
  return count > 0 ? moreApps(count) : null;
}

function batchDiscordBody(payload: AlertBatchPayload): unknown {
  const report = buildReport(payload, null);
  const title = clamp(headlineOf(report), DISCORD_NAME_MAX);
  const description = escapeDiscord(report.dateLabel);
  const fields: { name: string; value: string }[] = [];
  let used = title.length + description.length;
  for (const app of report.apps) {
    const group = chatGroup(app);
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
  let more = omittedLine(payload.apps.length, fields.length);
  while (
    more &&
    used + 1 + more.length > DISCORD_TOTAL_MAX &&
    fields.length > 0
  ) {
    const removed = fields.pop();
    if (removed) used -= removed.name.length + removed.value.length;
    more = omittedLine(payload.apps.length, fields.length);
  }
  if (more) {
    fields.push({ name: '…', value: more });
  }
  return {
    allowed_mentions: NO_MENTIONS,
    embeds: [{ title, description, fields }],
  };
}

function batchSlackBody(payload: AlertBatchPayload): unknown {
  const report = buildReport(payload, null);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: clamp(headlineOf(report), SLACK_HEADER_MAX),
      },
    },
  ];
  let used = 0;
  let shown = 0;
  for (const app of report.apps) {
    const group = chatGroup(app);
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
  const more = omittedLine(payload.apps.length, shown);
  if (more) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: more } });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: escapeSlack(report.dateLabel) }],
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
    return JSON.stringify({
      content: renderMessage(payload),
      allowed_mentions: NO_MENTIONS,
    });
  }
  if (isSlack(url)) {
    return JSON.stringify({ text: renderMessage(payload) });
  }
  return JSON.stringify(payload);
}
