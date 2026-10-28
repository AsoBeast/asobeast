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
      autoColumn(icon(app.identity.iconUrl)),
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

type FactRow = Extract<ReportRow, { kind: 'move' | 'change' }>;

const isFactRow = (row: ReportRow): row is FactRow =>
  row.kind === 'move' || row.kind === 'change';

function factOf(row: FactRow): { title: string; value: string } {
  return row.kind === 'move'
    ? {
        title: escapeTeams(row.label),
        value: `${row.from} → ${row.to}${row.note ? ` · ${row.note}` : ''}`,
      }
    : {
        title: escapeTeams(row.field),
        value: escapeTeams(`${row.before} → ${row.after}`),
      };
}

const factSet = (facts: FactSet['facts']): FactSet => ({
  type: 'FactSet',
  facts,
});

const autoColumn = (items: CardElement[]): Column => ({
  type: 'Column',
  width: 'auto',
  items,
});

function rowElements(row: ReportRow): CardElement[] {
  if (row.kind === 'text') {
    return [
      text(escapeTeams(row.text), { spacing: 'None' }),
      ...(row.detail
        ? [text(escapeTeams(row.detail), { isSubtle: true, spacing: 'None' })]
        : []),
    ];
  }
  if (row.kind === 'image') {
    return [
      text(row.field, { spacing: 'None' }),
      {
        type: 'ColumnSet',
        columns: [
          autoColumn(icon(row.beforeUrl)),
          autoColumn([text('→')]),
          autoColumn(icon(row.afterUrl)),
        ],
      },
    ];
  }
  return [];
}

function groupElements(group: ReportGroup, maxRows: number): CardElement[] {
  const rows = group.rows.slice(0, maxRows);
  const facts = rows.filter(isFactRow).map(factOf);
  const note = groupOmission({ ...group, rows }, teamsLink);
  return [
    text(`**${escapeTeams(group.title)}**`, { spacing: 'Medium' }),
    ...(facts.length > 0 ? [factSet(facts)] : []),
    ...rows.flatMap(rowElements),
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

function actionsOf(report: AlertReport): Pick<AdaptiveCard, 'actions'> {
  return report.link
    ? {
        actions: [
          {
            type: 'Action.OpenUrl',
            title: report.link.label,
            url: report.link.href,
          },
        ],
      }
    : {};
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
          ...actionsOf(report),
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
  for (
    let rows = SHORT_GROUP_ROWS;
    sizeOf(body) > PAYLOAD_MAX_BYTES && rows >= 0;
    rows -= 1
  ) {
    body = batchMessage(report, apps, rows);
  }
  return body;
}

function singleBody(report: AlertReport): TeamsMessage {
  const [app] = report.apps;
  return message(report, [
    ...heading(report),
    ...(app ? [appHeader(app)] : []),
    factSet(
      report.facts.map((fact) => ({
        title: escapeTeams(fact.label),
        value: escapeTeams(fact.value),
      })),
    ),
  ]);
}

export function teamsBody(report: AlertReport): TeamsMessage {
  return report.kind === 'batch' ? batchBody(report) : singleBody(report);
}
