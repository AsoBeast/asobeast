import type {
  AlertReport,
  ReportApp,
  ReportGroup,
  ReportRow,
} from '../report/report';
import {
  competitorsOmission,
  groupOmission,
  moreApps,
  type LinkFormat,
} from '../report/report-blocks';
import { identityLine } from '../report/storefront';
import { utcFallback } from './local-time';
import { isWebUrl } from './web-url';

interface TextBlock {
  type: 'TextBlock';
  text: string;
  wrap: true;
  weight?: 'Bolder';
  size?: 'Large';
  isSubtle?: true;
  spacing?: 'None' | 'Medium';
}

interface ImageElement {
  type: 'Image';
  url: string;
  size: 'Small';
  altText: string;
}

interface Column {
  type: 'Column';
  width: 'auto' | 'stretch';
  items: CardElement[];
}

interface ColumnSet {
  type: 'ColumnSet';
  columns: Column[];
}

interface FactSet {
  type: 'FactSet';
  facts: Array<{ title: string; value: string }>;
}

type CardElement = TextBlock | ImageElement | ColumnSet | FactSet;

interface AdaptiveCard {
  $schema: string;
  type: 'AdaptiveCard';
  version: '1.5';
  msteams: { width: 'Full' };
  body: CardElement[];
  actions?: Array<{ type: 'Action.OpenUrl'; title: string; url: string }>;
}

export interface TeamsMessage {
  type: 'message';
  attachments: [
    {
      contentType: 'application/vnd.microsoft.card.adaptive';
      contentUrl: null;
      content: AdaptiveCard;
    },
  ];
}

const SCHEMA = 'http://adaptivecards.io/schemas/adaptive-card.json';
const PAYLOAD_MAX_BYTES = 28 * 1024;
const SHORT_GROUP_ROWS = 5;

export function escapeTeams(text: string): string {
  return text.replace(/([\\*_[\]])/g, '\\$1');
}

const teamsLink: LinkFormat = (label, href) => `[${label}](${href})`;

const text = (
  value: string,
  options: Omit<TextBlock, 'type' | 'text' | 'wrap'> = {},
): TextBlock => ({ type: 'TextBlock', text: value, wrap: true, ...options });

function cardTime(iso: string): string | null {
  const millis = Date.parse(iso);
  if (Number.isNaN(millis)) return null;
  const seconds = `${new Date(millis).toISOString().slice(0, 19)}Z`;
  return `{{DATE(${seconds},SHORT)}} {{TIME(${seconds})}}`;
}

function dateLine(report: AlertReport): TextBlock {
  const local = cardTime(report.occurredAt);
  const label =
    report.kind === 'batch' ? utcFallback(report.dateLabel) : report.dateLabel;
  return text(local ? `${label} · ${local}` : label, {
    isSubtle: true,
    spacing: 'None',
  });
}

function icon(url: string | null): ImageElement[] {
  return isWebUrl(url)
    ? [{ type: 'Image', url, size: 'Small', altText: '' }]
    : [];
}

function appHeader(app: ReportApp): ColumnSet {
  const name = escapeTeams(app.identity.name);
  const subtitle = identityLine(app, false);
  return {
    type: 'ColumnSet',
    columns: [
      { type: 'Column', width: 'auto', items: icon(app.identity.iconUrl) },
      {
        type: 'Column',
        width: 'stretch',
        items: [
          text(app.link ? `**[${name}](${app.link.href})**` : `**${name}**`),
          ...(subtitle
            ? [text(escapeTeams(subtitle), { isSubtle: true, spacing: 'None' })]
            : []),
        ],
      },
    ],
  };
}

function factOf(row: ReportRow): { title: string; value: string } {
  switch (row.kind) {
    case 'move':
      return {
        title: escapeTeams(row.label),
        value: `${row.from} → ${row.to}${row.note ? ` · ${row.note}` : ''}`,
      };
    case 'change':
      return {
        title: escapeTeams(row.field),
        value: escapeTeams(`${row.before} → ${row.after}`),
      };
    case 'image':
      return { title: row.field, value: '' };
    case 'text':
      return {
        title: escapeTeams(row.text),
        value: escapeTeams(row.detail ?? ''),
      };
  }
}

function imageChanges(rows: ReportRow[]): ColumnSet[] {
  return rows.flatMap((row) =>
    row.kind === 'image'
      ? [
          {
            type: 'ColumnSet' as const,
            columns: [
              {
                type: 'Column' as const,
                width: 'auto' as const,
                items: icon(row.beforeUrl),
              },
              {
                type: 'Column' as const,
                width: 'auto' as const,
                items: [text('→')],
              },
              {
                type: 'Column' as const,
                width: 'auto' as const,
                items: icon(row.afterUrl),
              },
            ],
          },
        ]
      : [],
  );
}

function groupElements(group: ReportGroup, maxRows: number): CardElement[] {
  const rows = group.rows.slice(0, maxRows);
  const shown = { ...group, rows };
  const note = groupOmission(shown, teamsLink);
  return [
    text(`**${escapeTeams(group.title)}**`, { spacing: 'Medium' }),
    { type: 'FactSet', facts: rows.map(factOf) },
    ...imageChanges(rows),
    ...(note ? [text(note)] : []),
  ];
}

function appElements(app: ReportApp, maxRows: number): CardElement[] {
  const note = competitorsOmission(app, teamsLink);
  return [
    appHeader(app),
    ...app.groups.flatMap((group) => groupElements(group, maxRows)),
    ...app.competitors.flatMap((competitor) =>
      appElements(competitor, maxRows),
    ),
    ...(note ? [text(note)] : []),
  ];
}

function message(report: AlertReport, body: CardElement[]): TeamsMessage {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: SCHEMA,
          type: 'AdaptiveCard',
          version: '1.5',
          msteams: { width: 'Full' },
          body,
          ...(report.link
            ? {
                actions: [
                  {
                    type: 'Action.OpenUrl' as const,
                    title: report.link.label,
                    url: report.link.href,
                  },
                ],
              }
            : {}),
        },
      },
    ],
  };
}

const sizeOf = (value: TeamsMessage): number =>
  Buffer.byteLength(JSON.stringify(value));

function heading(report: AlertReport): CardElement[] {
  return [
    text(escapeTeams(report.headline), { size: 'Large', weight: 'Bolder' }),
    dateLine(report),
  ];
}

function batchMessage(
  report: AlertReport,
  apps: ReportApp[],
  maxRows: number,
): TeamsMessage {
  const omitted = report.omittedApps + report.apps.length - apps.length;
  return message(report, [
    ...heading(report),
    ...apps.flatMap((app) => appElements(app, maxRows)),
    ...(omitted > 0 ? [text(moreApps(omitted))] : []),
  ]);
}

function batchBody(report: AlertReport): TeamsMessage {
  const apps = [...report.apps];
  let body = batchMessage(report, apps, Number.POSITIVE_INFINITY);
  while (sizeOf(body) > PAYLOAD_MAX_BYTES && apps.length > 1) {
    apps.pop();
    body = batchMessage(report, apps, Number.POSITIVE_INFINITY);
  }
  return sizeOf(body) > PAYLOAD_MAX_BYTES
    ? batchMessage(report, apps, SHORT_GROUP_ROWS)
    : body;
}

function singleBody(report: AlertReport): TeamsMessage {
  const [app] = report.apps;
  return message(report, [
    ...heading(report),
    ...(app ? [appHeader(app)] : []),
    {
      type: 'FactSet',
      facts: report.facts.map((fact) => ({
        title: escapeTeams(fact.label),
        value: escapeTeams(fact.value),
      })),
    },
  ]);
}

export function teamsBody(report: AlertReport): TeamsMessage {
  return report.kind === 'batch' ? batchBody(report) : singleBody(report);
}
