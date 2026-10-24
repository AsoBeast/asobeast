import type { AlertReport, ReportApp, ReportGroup } from '../report/report';
import {
  competitorsOmission,
  groupOmission,
  groupRowLines,
  moreApps,
  type LinkFormat,
} from '../report/report-blocks';
import { identityLine } from '../report/storefront';
import { boundedLines, clamp } from './bounded-text';
import { escapeSlack, slackName } from './chat-escape';
import { slackDate, utcFallback } from './local-time';

interface SlackMrkdwn {
  type: 'mrkdwn';
  text: string;
}

interface SlackImage {
  type: 'image';
  image_url: string;
  alt_text: string;
}

export type SlackBlock =
  | { type: 'header'; text: { type: 'plain_text'; text: string; emoji: true } }
  | { type: 'section'; text: SlackMrkdwn; accessory?: SlackImage }
  | { type: 'context'; elements: SlackMrkdwn[] }
  | { type: 'divider' }
  | {
      type: 'actions';
      elements: Array<{
        type: 'button';
        text: { type: 'plain_text'; text: string };
        url: string;
      }>;
    };

export interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
  unfurl_links: false;
  unfurl_media: false;
}

const HEADER_MAX = 150;
const SECTION_MAX = 3000;
const BLOCKS_MAX = 50;
const BUTTON_TEXT_MAX = 75;
const CLOSING_BLOCKS = 2;

const slackLink: LinkFormat = (label, href) =>
  `<${href}|${escapeSlack(label)}>`;

const isWebUrl = (url: string | null): url is string =>
  url !== null && /^https?:\/\//.test(url);

const mrkdwn = (text: string): SlackMrkdwn => ({ type: 'mrkdwn', text });

const section = (text: string, accessory?: SlackImage): SlackBlock => ({
  type: 'section',
  text: mrkdwn(clamp(text, SECTION_MAX)),
  ...(accessory ? { accessory } : {}),
});

function iconOf(app: ReportApp): SlackImage | undefined {
  const url = app.identity.iconUrl;
  return isWebUrl(url)
    ? { type: 'image', image_url: url, alt_text: app.identity.name }
    : undefined;
}

function appSection(app: ReportApp): SlackBlock {
  const name = slackName(app.identity.name);
  const title = app.link ? `<${app.link.href}|${name}>` : name;
  const subtitle = escapeSlack(identityLine(app, true));
  return section(
    subtitle ? `*${title}*\n${subtitle}` : `*${title}*`,
    iconOf(app),
  );
}

function groupSection(group: ReportGroup): SlackBlock {
  const title = `*${escapeSlack(group.title)}*`;
  const note = groupOmission(group, slackLink);
  const room = SECTION_MAX - title.length - 1 - (note ? note.length + 1 : 0);
  const rows = boundedLines(groupRowLines(group).map(escapeSlack), room);
  return section([title, rows, note].filter(Boolean).join('\n'));
}

function appBlocks(app: ReportApp): SlackBlock[] {
  const note = competitorsOmission(app, slackLink);
  return [
    appSection(app),
    ...app.groups.map(groupSection),
    ...app.competitors.flatMap((competitor) => [
      appSection(competitor),
      ...competitor.groups.map(groupSection),
    ]),
    ...(note ? [section(note)] : []),
    { type: 'divider' },
  ];
}

const hasContent = (app: ReportApp): boolean =>
  app.groups.length > 0 ||
  app.competitors.some((competitor) => competitor.groups.length > 0);

function heading(report: AlertReport, context: string): SlackBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: clamp(`${report.emoji} ${report.headline}`, HEADER_MAX),
        emoji: true,
      },
    },
    { type: 'context', elements: [mrkdwn(context)] },
  ];
}

function button(report: AlertReport): SlackBlock[] {
  if (!report.link) return [];
  return [
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: clamp(report.link.label, BUTTON_TEXT_MAX),
          },
          url: report.link.href,
        },
      ],
    },
  ];
}

function message(report: AlertReport, blocks: SlackBlock[]): SlackMessage {
  return {
    text: escapeSlack(`${report.emoji} ${report.headline}`),
    blocks,
    unfurl_links: false,
    unfurl_media: false,
  };
}

function batchBody(report: AlertReport): SlackMessage {
  const blocks = heading(
    report,
    `${escapeSlack(utcFallback(report.dateLabel))} · ${slackDate(report.occurredAt, report.dateLabel)}`,
  );
  const apps = report.apps.filter(hasContent);
  let shown = 0;
  for (const app of apps) {
    const next = appBlocks(app);
    if (blocks.length + next.length > BLOCKS_MAX - CLOSING_BLOCKS) break;
    blocks.push(...next);
    shown += 1;
  }
  const omitted = report.omittedApps + apps.length - shown;
  if (omitted > 0) blocks.push(section(moreApps(omitted)));
  return message(report, [...blocks, ...button(report)]);
}

function singleBody(report: AlertReport): SlackMessage {
  const [app] = report.apps;
  const facts = report.facts.map(({ label, value }) =>
    label
      ? `*${escapeSlack(label)}*: ${escapeSlack(value)}`
      : escapeSlack(value),
  );
  const body = [
    ...(app ? [`*${slackName(app.identity.name)}*`] : []),
    ...facts,
  ].join('\n');
  return message(report, [
    ...heading(report, slackDate(report.occurredAt, report.dateLabel)),
    section(body, app ? iconOf(app) : undefined),
    ...button(report),
  ]);
}

export function slackBody(report: AlertReport): SlackMessage {
  return report.kind === 'batch' ? batchBody(report) : singleBody(report);
}
