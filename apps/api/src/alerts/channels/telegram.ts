import type { AlertReport, ReportApp, ReportGroup } from '../report/report';
import {
  competitorsOmission,
  groupOmission,
  groupRowLines,
  moreApps,
  type LinkFormat,
} from '../report/report-blocks';
import { identityLine } from '../report/storefront';
import { clamp } from './bounded-text';
import { escapeHtml } from './chat-escape';
import { utcFallback } from './local-time';

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
  link_preview_options: { is_disabled: true };
  reply_markup?: { inline_keyboard: [[{ text: string; url: string }]] };
}

const TEXT_MAX = 4096;
const INDENT = '  ';
const FACT_MAX = 1000;

const anchor = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;

const htmlLink: LinkFormat = (label, href) => anchor(href, label);

export function visibleLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot);/g, '_')
    .length;
}

function groupLines(group: ReportGroup): string[] {
  const note = groupOmission(group, htmlLink);
  return [
    `<i>${escapeHtml(group.title)}</i>`,
    ...groupRowLines(group).map(escapeHtml),
    ...(note ? [note] : []),
  ];
}

function appLines(app: ReportApp): string[] {
  const name = app.link
    ? anchor(app.link.href, app.identity.name)
    : escapeHtml(app.identity.name);
  const subtitle = identityLine(app, true);
  const note = competitorsOmission(app, htmlLink);
  return [
    `<b>${name}</b>`,
    ...(subtitle ? [escapeHtml(subtitle)] : []),
    ...app.groups.flatMap(groupLines),
    ...app.competitors.flatMap((competitor) =>
      appLines(competitor).map((line) => `${INDENT}${line}`),
    ),
    ...(note ? [note] : []),
  ];
}

function headingLines(report: AlertReport): string[] {
  const date =
    report.kind === 'batch' ? utcFallback(report.dateLabel) : report.dateLabel;
  return [
    `<b>${escapeHtml(`${report.emoji} ${report.headline}`)}</b>`,
    escapeHtml(date),
    '',
  ];
}

const joined = (lines: string[]): string => lines.join('\n');

function fits(lines: string[], extra: string): boolean {
  return visibleLength(joined([...lines, extra])) <= TEXT_MAX;
}

function batchText(report: AlertReport): string {
  const lines = headingLines(report);
  let shown = 0;
  for (const app of report.apps) {
    const block = [...appLines(app), ''];
    const rest = moreApps(report.apps.length - shown + report.omittedApps);
    if (fits([...lines, ...block], rest)) {
      lines.push(...block);
      shown += 1;
      continue;
    }
    if (shown === 0) {
      for (const line of block) {
        if (!fits([...lines, line], rest)) break;
        lines.push(line);
      }
      shown = 1;
    }
    break;
  }
  const omitted = report.omittedApps + report.apps.length - shown;
  return joined(omitted > 0 ? [...lines, moreApps(omitted)] : lines).trimEnd();
}

function singleText(report: AlertReport): string {
  return joined([
    ...headingLines(report),
    ...report.facts.map(({ label, value }) =>
      label
        ? `<b>${escapeHtml(label)}</b>: ${escapeHtml(clamp(value, FACT_MAX))}`
        : escapeHtml(clamp(value, FACT_MAX)),
    ),
  ]);
}

function clampVisible(html: string): string {
  if (visibleLength(html) <= TEXT_MAX) return html;
  const plain = html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  return escapeHtml(clamp(plain, TEXT_MAX));
}

export function telegramBody(
  report: AlertReport,
  chatId: string,
): TelegramMessage {
  const text = report.kind === 'batch' ? batchText(report) : singleText(report);
  return {
    chat_id: chatId,
    text: clampVisible(text),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(report.link
      ? {
          reply_markup: {
            inline_keyboard: [
              [{ text: report.link.label, url: report.link.href }],
            ],
          },
        }
      : {}),
  };
}
