import type {
  AlertReport,
  ReportApp,
  ReportGroup,
  ReportTone,
} from '../report/report';
import { appTone } from '../report/build-report';
import {
  competitorsOmission,
  groupOmission,
  groupRowLines,
  moreApps,
  type LinkFormat,
} from '../report/report-blocks';
import { identityLine } from '../report/storefront';
import { boundedLines, clamp } from './bounded-text';
import { escapeDiscord } from './chat-escape';
import { discordTime, utcFallback } from './local-time';

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  url?: string;
  description?: string;
  color: number;
  timestamp: string;
  author?: { name: string; icon_url?: string };
  thumbnail?: { url: string };
  fields: DiscordField[];
  footer: { text: string };
}

export interface DiscordMessage {
  content: string;
  embeds: DiscordEmbed[];
  allowed_mentions: { parse: [] };
}

const CONTENT_MAX = 2000;
const TITLE_MAX = 256;
const DESCRIPTION_MAX = 4096;
const FIELD_NAME_MAX = 256;
const FIELD_VALUE_MAX = 1024;
const FIELD_VALUE_MIN = 80;
const FIELDS_MAX = 25;
const AUTHOR_MAX = 256;
const EMBEDS_MAX = 10;
const TOTAL_MAX = 6000;
const INLINE_VALUE_MAX = 40;
const BLANK_NAME = '​';

const COLOURS: Record<ReportTone, number> = {
  up: 0x0d7a3e,
  down: 0xc12535,
  neutral: 0xf89820,
  mixed: 0xf89820,
};

const markdownLink: LinkFormat = (label, href) => `[${label}](${href})`;

const isWebUrl = (url: string | null): url is string =>
  url !== null && /^https?:\/\//.test(url);

interface FieldSource {
  name: string;
  group: ReportGroup | null;
  note: string;
}

function fieldSources(app: ReportApp): FieldSource[] {
  const note = competitorsOmission(app, markdownLink);
  return [
    ...app.groups.map((group) => ({ name: group.title, group, note: '' })),
    ...app.competitors.flatMap((competitor) =>
      competitor.groups.map((group) => ({
        name: `Competitor · ${competitor.identity.name}`,
        group,
        note: '',
      })),
    ),
    ...(note ? [{ name: BLANK_NAME, group: null, note }] : []),
  ].slice(0, FIELDS_MAX);
}

function groupValue(group: ReportGroup, max: number): string {
  const note = groupOmission(group, markdownLink);
  const room = max - (note ? note.length + 1 : 0);
  const rows = boundedLines(groupRowLines(group).map(escapeDiscord), room);
  return note ? `${rows}\n${note}` : rows;
}

function fieldOf(source: FieldSource, max: number): DiscordField {
  return {
    name: clamp(escapeDiscord(source.name), FIELD_NAME_MAX),
    value: source.group ? groupValue(source.group, max) : source.note,
  };
}

function changedIcon(app: ReportApp): string | null {
  const groups = [
    ...app.groups,
    ...app.competitors.flatMap((rival) => rival.groups),
  ];
  for (const row of groups.flatMap((group) => group.rows)) {
    if (row.kind === 'image' && isWebUrl(row.afterUrl)) return row.afterUrl;
  }
  return null;
}

function thumbnailOf(app: ReportApp): DiscordEmbed['thumbnail'] {
  const url = isWebUrl(app.identity.iconUrl)
    ? app.identity.iconUrl
    : changedIcon(app);
  return url ? { url } : undefined;
}

function authorOf(app: ReportApp, withIcon: boolean): DiscordEmbed['author'] {
  const name = identityLine(app, true);
  if (!name) return undefined;
  const icon = app.identity.iconUrl;
  return withIcon && isWebUrl(icon)
    ? { name: clamp(name, AUTHOR_MAX), icon_url: icon }
    : { name: clamp(name, AUTHOR_MAX) };
}

const footerOf = (report: AlertReport): DiscordEmbed['footer'] => ({
  text: `AsoBeast · ${report.dateLabel}`,
});

export function embedSize(embed: DiscordEmbed): number {
  return [
    embed.title,
    embed.description,
    embed.author?.name,
    embed.footer.text,
    ...embed.fields.flatMap((field) => [field.name, field.value]),
  ].reduce((total, text) => total + (text?.trim().length ?? 0), 0);
}

function appEmbed(
  app: ReportApp,
  report: AlertReport,
  room: number,
): DiscordEmbed | null {
  const sources = fieldSources(app);
  const embed: DiscordEmbed = {
    title: clamp(escapeDiscord(app.identity.name), TITLE_MAX),
    ...(app.link ? { url: app.link.href } : {}),
    color: COLOURS[appTone(app)],
    timestamp: report.occurredAt,
    author: authorOf(app, false),
    thumbnail: thumbnailOf(app),
    fields: [],
    footer: footerOf(report),
  };
  const names = sources.reduce(
    (total, source) => total + source.name.length,
    0,
  );
  const perField = Math.min(
    FIELD_VALUE_MAX,
    Math.floor((room - embedSize(embed) - names) / sources.length),
  );
  if (perField < FIELD_VALUE_MIN) return null;
  embed.fields = sources.map((source) => fieldOf(source, perField));
  return embed;
}

function contentOf(report: AlertReport, omitted: number): string {
  const headline = `${report.emoji} ${escapeDiscord(report.headline)}`;
  if (omitted <= 0) return clamp(headline, CONTENT_MAX);
  const more = report.link
    ? `${moreApps(omitted)} · ${markdownLink(report.link.label, report.link.href)}`
    : moreApps(omitted);
  return clamp(`${headline}\n${more}`, CONTENT_MAX);
}

function batchBody(report: AlertReport): DiscordMessage {
  const apps = report.apps.filter((app) => fieldSources(app).length > 0);
  const description = clamp(
    `${utcFallback(report.dateLabel)} · ${discordTime(report.occurredAt, report.dateLabel)}`,
    DESCRIPTION_MAX,
  );
  const embeds: DiscordEmbed[] = [];
  let used = description.length;
  for (const app of apps) {
    if (embeds.length === EMBEDS_MAX) break;
    const embed = appEmbed(app, report, TOTAL_MAX - used);
    if (!embed) break;
    used += embedSize(embed);
    embeds.push(embed);
  }
  if (embeds.length > 0) embeds[0].description = description;
  return {
    content: contentOf(
      report,
      report.omittedApps + apps.length - embeds.length,
    ),
    embeds,
    allowed_mentions: { parse: [] },
  };
}

function factField(label: string, value: string): DiscordField {
  const text = clamp(escapeDiscord(value), FIELD_VALUE_MAX);
  return {
    name: label ? clamp(escapeDiscord(label), FIELD_NAME_MAX) : BLANK_NAME,
    value: text,
    inline: text.length <= INLINE_VALUE_MAX,
  };
}

function singleBody(report: AlertReport): DiscordMessage {
  const [app] = report.apps;
  const embed: DiscordEmbed = {
    ...(app
      ? { title: clamp(escapeDiscord(app.identity.name), TITLE_MAX) }
      : {}),
    ...(app && report.link ? { url: report.link.href } : {}),
    description: `${discordTime(report.occurredAt, report.dateLabel)} · ${report.dateLabel}`,
    color: COLOURS[report.tone],
    timestamp: report.occurredAt,
    author: app ? authorOf(app, true) : undefined,
    thumbnail: app ? thumbnailOf(app) : undefined,
    fields: report.facts
      .slice(0, FIELDS_MAX)
      .map((fact) => factField(fact.label, fact.value)),
    footer: footerOf(report),
  };
  return {
    content: contentOf(report, 0),
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };
}

export function discordBody(report: AlertReport): DiscordMessage {
  return report.kind === 'batch' ? batchBody(report) : singleBody(report);
}
