import type { AlertReport, ReportApp, ReportGroup } from './report';
import { competitorsOmission, groupLines } from './report-blocks';
import { identityLine } from './storefront';

const INDENT = '  ';

const indent = (lines: string[], depth: number): string[] =>
  lines.map((line) => `${INDENT.repeat(depth)}${line}`);

function groupText(group: ReportGroup, depth: number): string[] {
  return [
    '',
    ...indent([group.title], depth),
    ...indent(groupLines(group), depth + 1),
  ];
}

function appText(app: ReportApp, depth: number): string[] {
  const subtitle = [identityLine(app, false), app.link?.href]
    .filter(Boolean)
    .join(' · ');
  const note = competitorsOmission(app);
  return [
    ...indent([app.identity.name, ...(subtitle ? [subtitle] : [])], depth),
    ...app.groups.flatMap((group) => groupText(group, depth + 1)),
    ...app.competitors.flatMap((competitor) => [
      '',
      ...appText(competitor, depth + 1),
    ]),
    ...indent(note ? [note] : [], depth + 1),
  ];
}

function omittedAppsLine(report: AlertReport): string[] {
  if (report.omittedApps <= 0) return [];
  const more = `+${report.omittedApps} more app${report.omittedApps === 1 ? '' : 's'}`;
  return [
    report.link ? `${more} · ${report.link.label}: ${report.link.href}` : more,
  ];
}

function batchText(report: AlertReport): string[] {
  return [
    report.headline,
    report.dateLabel,
    '',
    ...report.apps.flatMap((app) => [...appText(app, 0), '']),
    ...omittedAppsLine(report),
  ];
}

function singleText(report: AlertReport): string[] {
  return [
    report.headline,
    '',
    ...report.facts.map(({ label, value }) =>
      label ? `${label}: ${value}` : value,
    ),
    ...(report.link ? [`${report.link.label}: ${report.link.href}`] : []),
    '',
    report.dateLabel,
  ];
}

export function reportText(report: AlertReport): string {
  const lines =
    report.kind === 'batch' ? batchText(report) : singleText(report);
  return lines.join('\n').trimEnd();
}
