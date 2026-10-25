import type { ReportApp, ReportGroup, ReportRow } from './report';

export interface ReportBlock {
  title: string;
  lines: string[];
}

export function rowText(row: ReportRow): string {
  switch (row.kind) {
    case 'move':
      return `${row.label}  ${row.from} → ${row.to}${row.note ? ` · ${row.note}` : ''}`;
    case 'text':
      return row.text;
    case 'change':
      return `${row.field}: ${row.before} → ${row.after}`;
    case 'image':
      return row.field;
  }
}

function rowLines(row: ReportRow): string[] {
  return row.kind === 'text' && row.detail
    ? [row.text, `  ${row.detail}`]
    : [rowText(row)];
}

export type LinkFormat = (label: string, href: string) => string;

const plainLink: LinkFormat = (label, href) => `${label}: ${href}`;

export function groupOmission(
  group: ReportGroup,
  link: LinkFormat = plainLink,
): string | null {
  const hidden = group.total - group.rows.length;
  if (hidden <= 0) return null;
  return group.link
    ? link(`See all ${group.total}`, group.link.href)
    : `+${hidden} more`;
}

export const moreApps = (count: number): string =>
  `+${count} more app${count === 1 ? '' : 's'}`;

export function competitorsOmission(
  app: ReportApp,
  link: LinkFormat = plainLink,
): string | null {
  if (app.omittedCompetitors <= 0) return null;
  return app.competitorsLink
    ? link(app.competitorsLink.label, app.competitorsLink.href)
    : `+${app.omittedCompetitors} more competitor${app.omittedCompetitors === 1 ? '' : 's'}`;
}

export function groupRowLines(group: ReportGroup): string[] {
  return group.rows.flatMap(rowLines);
}

export function groupLines(group: ReportGroup): string[] {
  const note = groupOmission(group);
  return [...groupRowLines(group), ...(note ? [note] : [])];
}
