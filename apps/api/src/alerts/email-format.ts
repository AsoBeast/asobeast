import {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertPayload,
  keywordLabel,
} from '@asobeast/shared';
import { summarizeActionEvidence } from './action-lines';
import {
  AlertBatchBlock,
  appHeader,
  appLabel,
  batchHeadline,
  changeLines,
  rank,
  sectionBlocks,
  stars,
  storeLabel,
  summarize,
} from './alert-summary';

const DIGEST_APP_CAP = 10;
const BATCH_GROUP_CAP = 10;
const COMPETITOR_CAP = 10;
const DETAIL_LINE_CAP = 20;

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

type Row = [string, string];

function value(raw: string | null): string {
  return raw ?? '—';
}

function signedDelta(delta: number | null): string {
  if (delta === null) {
    return '—';
  }
  const rounded = Math.round(delta * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function detailRows(payload: Exclude<AlertPayload, AlertBatchPayload>): Row[] {
  if (payload.event === 'metadata.changed') {
    const rows: Row[] = [
      ['App', appLabel(payload.app.name)],
      ['Type', payload.app.isCompetitor ? 'Competitor' : 'Primary'],
    ];
    payload.changes.forEach((change) => {
      rows.push([
        change.field,
        `${value(change.before)} → ${value(change.after)}`,
      ]);
    });
    return rows;
  }

  if (payload.event === 'rank.dropped' || payload.event === 'rank.improved') {
    return [
      ['App', appLabel(payload.app.name)],
      ['Keyword', keywordLabel(payload.keyword)],
      ['From', rank(payload.from, payload.fromDepth)],
      ['To', rank(payload.to, payload.toDepth)],
      ['Threshold', `${payload.threshold}`],
    ];
  }

  if (payload.event === 'review.negative') {
    return [
      ['App', appLabel(payload.app.name)],
      ['Rating', stars(payload.review.score)],
      ['Version', value(payload.review.version)],
      ['Title', value(payload.review.title)],
      ['Review', payload.review.text],
    ];
  }

  if (payload.event === 'serp.entrant') {
    return [
      ['Keyword', keywordLabel(payload.keyword)],
      ['Date', payload.date],
      ...payload.entrants.map((entrant): Row => [
        `#${entrant.position}`,
        entrant.isCompetitor ? `${entrant.title} (competitor)` : entrant.title,
      ]),
    ];
  }

  if (payload.event === 'action.opened') {
    const rows: Row[] = [
      ['App', appLabel(payload.app.name)],
      ['Rule', payload.action.rule],
      ['Priority', payload.action.priority],
      ['Estimated impact', `${payload.action.impact}`],
      ['Evidence', summarizeActionEvidence(payload.evidence)],
    ];
    if (payload.keyword) {
      rows.push([
        'Keyword',
        keywordLabel({
          text: payload.keyword.text,
          country: payload.app.country,
        }),
      ]);
    }
    if (payload.link) {
      rows.push(['Open', payload.link]);
    }
    return rows;
  }

  const rows: Row[] = [
    ['Window', `${payload.window.from} → ${payload.window.to}`],
  ];
  if (payload.groups.length > 0) {
    rows.push(['', 'Linked apps']);
    payload.groups.forEach((group) => {
      rows.push([
        group.name,
        `vis ${Math.round(group.visibility.current)} (${signedDelta(group.visibility.delta7d)})`,
      ]);
    });
  }
  payload.apps.slice(0, DIGEST_APP_CAP).forEach((app) => {
    const cells = [
      `vis ${Math.round(app.visibility.current)} (${signedDelta(app.visibility.delta7d)})`,
    ];
    if (app.audit && app.audit.current !== null) {
      cells.push(
        `Audit ${Math.round(app.audit.current)} (${signedDelta(app.audit.delta7d)})`,
      );
    }
    if (app.actions) {
      cells.push(
        `Actions ${app.actions.open} open (${app.actions.critical} critical, ${app.actions.high} high)`,
      );
    }
    rows.push([appLabel(app.name), cells.join(' · ')]);
  });
  if (payload.apps.length > DIGEST_APP_CAP) {
    rows.push(['', `+${payload.apps.length - DIGEST_APP_CAP} more`]);
  }
  return rows;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlRow([label, cell]: Row): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(cell)}</td></tr>`;
}

export function formatEmail(payload: AlertPayload): EmailContent {
  if (payload.event === 'alerts.batch') {
    return formatBatchEmail(payload);
  }
  const summary = summarize(payload);
  const rows = detailRows(payload);

  const text = [
    summary,
    '',
    ...rows.map(([label, cell]) => (label ? `${label}: ${cell}` : cell)),
    '',
    `Occurred at ${payload.occurredAt}`,
  ].join('\n');

  const html = [
    `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">`,
    `<p style="font-size:16px;font-weight:600;margin:0 0 12px">${escapeHtml(summary)}</p>`,
    `<table style="border-collapse:collapse;font-size:14px">${rows.map(htmlRow).join('')}</table>`,
    `<p style="font-size:12px;color:#94a3b8;margin:16px 0 0">Occurred at ${escapeHtml(payload.occurredAt)}</p>`,
    `</div>`,
  ].join('');

  return { subject: `[asobeast] ${summary}`, text, html };
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function more(count: number, singular: string): string {
  return `+${count} more ${singular}${count === 1 ? '' : 's'}`;
}

interface OwnedCounts {
  rankDrops: number;
  rankImprovements: number;
  serpEntrants: number;
  changes: number;
  negativeReviews: number;
  actions: number;
}

function countOwned(payload: AlertBatchPayload): OwnedCounts {
  const counts: OwnedCounts = {
    rankDrops: 0,
    rankImprovements: 0,
    serpEntrants: 0,
    changes: 0,
    negativeReviews: 0,
    actions: 0,
  };
  for (const section of payload.apps) {
    counts.rankDrops += section.rankDrops.length;
    counts.rankImprovements += section.rankImprovements.length;
    counts.serpEntrants += section.serpEntrants.length;
    counts.changes += section.changes.length;
    counts.negativeReviews += section.negativeReviews.length;
    counts.actions += section.actions.length;
  }
  return counts;
}

function ownedSummary(payload: AlertBatchPayload): string {
  const counts = countOwned(payload);
  return [
    plural(counts.rankDrops, 'rank drop'),
    plural(counts.rankImprovements, 'rank improvement'),
    plural(counts.serpEntrants, 'SERP entrant'),
    plural(counts.changes, 'metadata change'),
    plural(counts.negativeReviews, 'negative review'),
    plural(counts.actions, 'new action'),
  ].join(' · ');
}

function limitedLines(lines: string[]): string[] {
  const visible = lines.slice(0, DETAIL_LINE_CAP);
  if (lines.length > visible.length) {
    visible.push(more(lines.length - visible.length, 'detail line'));
  }
  return visible;
}

function ownedText(payload: AlertBatchPayload): string {
  const lines = [
    batchHeadline(payload),
    `Summary: ${ownedSummary(payload)}`,
    `Window (UTC): ${payload.window.from} → ${payload.window.to}`,
    '',
  ];
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  for (const section of sections) {
    lines.push(appHeader(section));
    for (const block of sectionBlocks(section)) {
      lines.push(`  ${block.title}`);
      limitedLines(block.lines).forEach((line) => lines.push(`    ${line}`));
    }
    lines.push('');
  }
  if (payload.apps.length > sections.length) {
    lines.push(more(payload.apps.length - sections.length, 'app group'));
  }
  return lines.join('\n');
}

function htmlList(lines: string[]): string {
  const items = lines
    .map((line) => `<li style="margin:2px 0">${escapeHtml(line)}</li>`)
    .join('');
  return `<ul style="margin:4px 0 8px;padding-left:18px">${items}</ul>`;
}

function htmlBlock(block: AlertBatchBlock): string {
  return `<p style="margin:8px 0 2px;font-weight:600;font-size:13px">${escapeHtml(block.title)}</p>${htmlList(limitedLines(block.lines))}`;
}

function ownedHtmlCard(section: AlertBatchAppSection): string {
  const blocks = sectionBlocks(section).map(htmlBlock).join('');
  return [
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:0 0 12px;overflow-wrap:anywhere">`,
    `<p style="margin:0 0 4px;font-weight:700;font-size:15px">${escapeHtml(appHeader(section))}</p>`,
    blocks,
    `</div>`,
  ].join('');
}

function emailHtml(headline: string, summary: string, body: string): string {
  return [
    `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">`,
    `<p style="font-size:18px;font-weight:700;margin:0 0 8px">${escapeHtml(headline)}</p>`,
    `<p style="font-size:13px;margin:0 0 12px">${escapeHtml(summary)}</p>`,
    body,
    `</div>`,
  ].join('');
}

function formatOwnedBatch(payload: AlertBatchPayload): EmailContent {
  const headline = batchHeadline(payload);
  const summary = `Summary: ${ownedSummary(payload)} · Window (UTC): ${payload.window.from} → ${payload.window.to}`;
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  const omitted = payload.apps.length - sections.length;
  const body = [
    sections.map(ownedHtmlCard).join(''),
    omitted > 0 ? `<p>${more(omitted, 'app group')}</p>` : '',
  ].join('');
  return {
    subject: `[asobeast] ${headline}`,
    text: ownedText(payload),
    html: emailHtml(headline, summary, body),
  };
}

function competitorLabel(
  competitor: AlertBatchAppSection['competitors'][number],
): string {
  return `${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)} · ${competitor.app.country.toUpperCase()}`;
}

function competitorText(payload: AlertBatchPayload): string {
  const lines = [
    batchHeadline(payload),
    `Window (UTC): ${payload.window.from} → ${payload.window.to}`,
    '',
  ];
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  for (const section of sections) {
    lines.push(`Primary app · ${appHeader(section)}`);
    const competitors = section.competitors.slice(0, COMPETITOR_CAP);
    for (const competitor of competitors) {
      lines.push(`  Competitor · ${competitorLabel(competitor)}`);
      limitedLines(competitor.changes.flatMap(changeLines)).forEach((line) =>
        lines.push(`    ${line}`),
      );
    }
    if (section.competitors.length > competitors.length) {
      lines.push(
        `  ${more(section.competitors.length - competitors.length, 'competitor')}`,
      );
    }
    lines.push('');
  }
  if (payload.apps.length > sections.length) {
    lines.push(
      more(payload.apps.length - sections.length, 'primary app group'),
    );
  }
  return lines.join('\n');
}

function competitorHtmlCard(
  competitor: AlertBatchAppSection['competitors'][number],
): string {
  return [
    `<div style="border-left:3px solid #64748b;padding:6px 10px;margin:8px 0;overflow-wrap:anywhere">`,
    `<p style="font-weight:700;margin:0 0 4px">Competitor · ${escapeHtml(competitorLabel(competitor))}</p>`,
    htmlList(limitedLines(competitor.changes.flatMap(changeLines))),
    `</div>`,
  ].join('');
}

function competitorHtmlGroup(section: AlertBatchAppSection): string {
  const competitors = section.competitors.slice(0, COMPETITOR_CAP);
  const omitted = section.competitors.length - competitors.length;
  return [
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:0 0 12px">`,
    `<p style="font-size:15px;font-weight:700;margin:0 0 8px">Primary app · ${escapeHtml(appHeader(section))}</p>`,
    competitors.map(competitorHtmlCard).join(''),
    omitted > 0 ? `<p>${more(omitted, 'competitor')}</p>` : '',
    `</div>`,
  ].join('');
}

function formatCompetitorBatch(payload: AlertBatchPayload): EmailContent {
  const headline = batchHeadline(payload);
  const summary = `Window (UTC): ${payload.window.from} → ${payload.window.to}`;
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  const omitted = payload.apps.length - sections.length;
  const body = [
    sections.map(competitorHtmlGroup).join(''),
    omitted > 0 ? `<p>${more(omitted, 'primary app group')}</p>` : '',
  ].join('');
  return {
    subject: `[asobeast] ${headline}`,
    text: competitorText(payload),
    html: emailHtml(headline, summary, body),
  };
}

function legacyBatchText(payload: AlertBatchPayload): string {
  const lines = [
    `Daily alert update — ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'app')}`,
    `Window (UTC): ${payload.window.from} → ${payload.window.to}`,
    '',
  ];
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  for (const section of sections) {
    lines.push(appHeader(section));
    for (const block of sectionBlocks(section)) {
      lines.push(`  ${block.title}`);
      limitedLines(block.lines).forEach((line) => lines.push(`    ${line}`));
    }
    const competitors = section.competitors.slice(0, COMPETITOR_CAP);
    for (const competitor of competitors) {
      lines.push(`  Competitor · ${competitorLabel(competitor)}`);
      limitedLines(competitor.changes.flatMap(changeLines)).forEach((line) =>
        lines.push(`    ${line}`),
      );
    }
    if (section.competitors.length > competitors.length) {
      lines.push(
        `  ${more(section.competitors.length - competitors.length, 'competitor')}`,
      );
    }
    lines.push('');
  }
  if (payload.apps.length > sections.length) {
    lines.push(more(payload.apps.length - sections.length, 'app group'));
  }
  return lines.join('\n');
}

function legacyHtmlCard(section: AlertBatchAppSection): string {
  const blocks = sectionBlocks(section).map(htmlBlock).join('');
  const competitors = section.competitors.slice(0, COMPETITOR_CAP);
  const omitted = section.competitors.length - competitors.length;
  return [
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:0 0 12px;overflow-wrap:anywhere">`,
    `<p style="margin:0 0 4px;font-weight:700;font-size:15px">${escapeHtml(appHeader(section))}</p>`,
    blocks,
    competitors.map(competitorHtmlCard).join(''),
    omitted > 0 ? `<p>${more(omitted, 'competitor')}</p>` : '',
    `</div>`,
  ].join('');
}

function formatLegacyBatch(payload: AlertBatchPayload): EmailContent {
  const headline = `Daily alert update — ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'app')}`;
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  const omitted = payload.apps.length - sections.length;
  const body = [
    sections.map(legacyHtmlCard).join(''),
    omitted > 0 ? `<p>${more(omitted, 'app group')}</p>` : '',
  ].join('');
  return {
    subject: `[asobeast] ${headline}`,
    text: legacyBatchText(payload),
    html: emailHtml(
      headline,
      `Window (UTC): ${payload.window.from} → ${payload.window.to}`,
      body,
    ),
  };
}

export function formatBatchEmail(payload: AlertBatchPayload): EmailContent {
  if (payload.scope === 'owned_apps') return formatOwnedBatch(payload);
  if (payload.scope === 'competitors') return formatCompetitorBatch(payload);
  return formatLegacyBatch(payload);
}
