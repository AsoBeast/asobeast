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

export function rowLines(row: ReportRow): string[] {
  return row.kind === 'text' && row.detail
    ? [row.text, `  ${row.detail}`]
    : [rowText(row)];
}

export function omissionLine(group: ReportGroup): string | null {
  const hidden = group.total - group.rows.length;
  if (hidden <= 0) return null;
  return group.link
    ? `See all ${group.total}: ${group.link.href}`
    : `+${hidden} more`;
}

export const moreApps = (count: number): string =>
  `+${count} more app${count === 1 ? '' : 's'}`;

export function competitorsOmission(app: ReportApp): string | null {
  if (app.omittedCompetitors <= 0) return null;
  return app.competitorsLink
    ? `${app.competitorsLink.label}: ${app.competitorsLink.href}`
    : `+${app.omittedCompetitors} more competitor${app.omittedCompetitors === 1 ? '' : 's'}`;
}

export function groupLines(group: ReportGroup): string[] {
  const note = omissionLine(group);
  return [...group.rows.flatMap(rowLines), ...(note ? [note] : [])];
}

export function blocksOf(app: ReportApp): ReportBlock[] {
  const note = competitorsOmission(app);
  return [
    ...app.groups.map((group) => ({
      title: group.title,
      lines: groupLines(group),
    })),
    ...app.competitors.map((competitor) => ({
      title: `Competitor · ${competitor.identity.name}`,
      lines: competitor.groups.flatMap(groupLines),
    })),
    ...(note ? [{ title: '', lines: [note] }] : []),
  ];
}
