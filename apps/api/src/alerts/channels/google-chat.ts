import type {
  AlertReport,
  ReportApp,
  ReportFact,
  ReportGroup,
  ReportRow,
} from '../report/report';
import {
  competitorsOmission,
  groupOmission,
  moreApps,
  rowText,
  type LinkFormat,
} from '../report/report-blocks';
import { identityLine } from '../report/storefront';
import { utcFallback } from './local-time';
import { escapeHtml } from './chat-escape';
import { isWebUrl } from './web-url';

type Widget =
  | {
      decoratedText: {
        topLabel?: string;
        text: string;
        wrapText: true;
        startIcon?: { iconUrl: string };
      };
    }
  | { textParagraph: { text: string } }
  | {
      buttonList: {
        buttons: Array<{
          text: string;
          onClick: { openLink: { url: string } };
        }>;
      };
    };

interface CardSection {
  header?: string;
  widgets: Widget[];
}

interface Card {
  header: {
    title: string;
    subtitle: string;
    imageUrl?: string;
    imageType?: 'SQUARE';
    imageAltText?: string;
  };
  sections: CardSection[];
}

export interface GoogleChatMessage {
  text: string;
  cardsV2: [{ cardId: string; card: Card }];
}

const CARD_MAX_BYTES = 32_000;
const WIDGETS_MAX = 100;
const CLOSING_WIDGETS = 2;

const chatLink: LinkFormat = (label, href) =>
  `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;

const paragraph = (text: string): Widget => ({ textParagraph: { text } });

function rowWidget(row: ReportRow, topLabel: string | undefined): Widget {
  const label = topLabel ? { topLabel: escapeHtml(topLabel) } : {};
  if (row.kind === 'image' && isWebUrl(row.afterUrl)) {
    return {
      decoratedText: {
        ...label,
        text: escapeHtml(row.field),
        wrapText: true,
        startIcon: { iconUrl: row.afterUrl },
      },
    };
  }
  const detail =
    row.kind === 'text' && row.detail ? `<br>${escapeHtml(row.detail)}` : '';
  return {
    decoratedText: {
      ...label,
      text: `${escapeHtml(rowText(row))}${detail}`,
      wrapText: true,
    },
  };
}

function groupWidgets(group: ReportGroup, maxRows: number): Widget[] {
  const rows = group.rows.slice(0, maxRows);
  const note = groupOmission({ ...group, rows }, chatLink);
  return [
    ...rows.map((row, index) =>
      rowWidget(row, index === 0 ? group.title : undefined),
    ),
    ...(note ? [paragraph(note)] : []),
  ];
}

function appSections(app: ReportApp, maxRows: number): CardSection[] {
  const name = escapeHtml(app.identity.name);
  const title = app.link ? chatLink(app.identity.name, app.link.href) : name;
  const subtitle = escapeHtml(identityLine(app, true));
  const note = competitorsOmission(app, chatLink);
  return [
    {
      header: `<b>${name}</b>`,
      widgets: [
        paragraph(subtitle ? `${title} · ${subtitle}` : title),
        ...app.groups.flatMap((group) => groupWidgets(group, maxRows)),
        ...(note ? [paragraph(note)] : []),
      ],
    },
    ...app.competitors.flatMap((competitor) =>
      appSections(competitor, maxRows),
    ),
  ];
}

const widgetCount = (sections: CardSection[]): number =>
  sections.reduce((total, section) => total + section.widgets.length, 0);

function buttonSection(report: AlertReport): CardSection[] {
  if (!report.link) return [];
  return [
    {
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: report.link.label,
                onClick: { openLink: { url: report.link.href } },
              },
            ],
          },
        },
      ],
    },
  ];
}

function closingSections(report: AlertReport, omitted: number): CardSection[] {
  return [
    ...(omitted > 0 ? [{ widgets: [paragraph(moreApps(omitted))] }] : []),
    ...buttonSection(report),
  ];
}

function headerOf(report: AlertReport): Card['header'] {
  const app = report.apps.find((candidate) =>
    isWebUrl(candidate.identity.iconUrl),
  );
  const subtitle =
    report.kind === 'batch' ? utcFallback(report.dateLabel) : report.dateLabel;
  return {
    title: `${report.emoji} ${report.headline}`,
    subtitle,
    ...(app?.identity.iconUrl
      ? {
          imageUrl: app.identity.iconUrl,
          imageType: 'SQUARE',
          imageAltText: app.identity.name,
        }
      : {}),
  };
}

function message(
  report: AlertReport,
  sections: CardSection[],
): GoogleChatMessage {
  return {
    text: `${report.emoji} ${report.headline}`
      .replace(/</g, '‹')
      .replace(/>/g, '›'),
    cardsV2: [
      {
        cardId: `${report.event}-${report.occurredAt.slice(0, 10)}`,
        card: { header: headerOf(report), sections },
      },
    ],
  };
}

const sizeOf = (value: GoogleChatMessage): number =>
  Buffer.byteLength(JSON.stringify(value));

const ROW_STEPS = [Number.POSITIVE_INFINITY, 5, 1];

function fittingSections(
  report: AlertReport,
  maxRows: number,
): { sections: CardSection[]; shown: number } {
  const closing = closingSections(
    report,
    report.omittedApps + report.apps.length,
  );
  const sections: CardSection[] = [];
  let shown = 0;
  for (const app of report.apps) {
    const next = [...sections, ...appSections(app, maxRows)];
    if (
      widgetCount(next) > WIDGETS_MAX - CLOSING_WIDGETS ||
      sizeOf(message(report, [...next, ...closing])) > CARD_MAX_BYTES
    ) {
      break;
    }
    sections.push(...appSections(app, maxRows));
    shown += 1;
  }
  return { sections, shown };
}

function batchBody(report: AlertReport): GoogleChatMessage {
  let fitted = fittingSections(report, ROW_STEPS[0]);
  for (const maxRows of ROW_STEPS.slice(1)) {
    if (fitted.shown > 0 || report.apps.length === 0) break;
    fitted = fittingSections(report, maxRows);
  }
  const omitted = report.omittedApps + report.apps.length - fitted.shown;
  return message(report, [
    ...fitted.sections,
    ...closingSections(report, omitted),
  ]);
}

const factWidget = ({ label, value }: ReportFact): Widget => ({
  decoratedText: {
    ...(label ? { topLabel: escapeHtml(label) } : {}),
    text: escapeHtml(value),
    wrapText: true,
  },
});

function singleBody(report: AlertReport): GoogleChatMessage {
  const facts = report.facts.map(factWidget);
  const bodyOf = (shown: number): GoogleChatMessage => {
    const hidden = facts.length - shown;
    const more = hidden > 0 ? [paragraph(`+${hidden} more`)] : [];
    return message(report, [
      { widgets: [...facts.slice(0, shown), ...more] },
      ...buttonSection(report),
    ]);
  };
  let shown = Math.min(facts.length, WIDGETS_MAX - CLOSING_WIDGETS);
  while (shown > 0 && sizeOf(bodyOf(shown)) > CARD_MAX_BYTES) shown -= 1;
  return bodyOf(shown);
}

export function googleChatBody(report: AlertReport): GoogleChatMessage {
  return report.kind === 'batch' ? batchBody(report) : singleBody(report);
}
