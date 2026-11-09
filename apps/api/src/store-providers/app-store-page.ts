import * as cheerio from 'cheerio';

export interface PageAppEvent {
  appEventId: string;
  title: string | null;
  kind: string | null;
  badge: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface PageFeaturedStory {
  storyId: string | null;
  heading: string | null;
  title: string | null;
}

export interface PageEditorsChoice {
  showsBadge: boolean;
  notes: string | null;
}

export interface AppStorePageExtract {
  previewVideoUrls: string[];
  appEvents: PageAppEvent[];
  featuredStories: PageFeaturedStory[];
  editorsChoice: PageEditorsChoice | null;
  accessibilityStatement: string | null;
}

const SERVER_DATA_SELECTOR = 'script#serialized-server-data';

const PRODUCT_MEDIA_KEY = /^product_media_/;

const STORY_ID = /\/story\/id(\d+)/;

export function parseAppStorePage(html: string): AppStorePageExtract {
  return readShelves(shelfMappingOf(html));
}

function shelfMappingOf(html: string): Record<string, unknown> {
  const embedded = cheerio.load(html)(SERVER_DATA_SELECTOR).first().html();
  if (embedded === null || embedded.trim().length === 0) {
    throw new Error('product page embeds no serialized server data');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(embedded);
  } catch {
    throw new Error('serialized server data is not valid JSON');
  }
  const entries = asRecord(parsed)?.data;
  if (!Array.isArray(entries)) {
    throw new Error('serialized server data carries no shelf mapping');
  }
  for (const entry of entries) {
    const mapping = asRecord(asRecord(asRecord(entry)?.data)?.shelfMapping);
    if (mapping !== null) {
      return mapping;
    }
  }
  throw new Error('serialized server data carries no shelf mapping');
}

function readShelves(shelves: Record<string, unknown>): AppStorePageExtract {
  return {
    previewVideoUrls: previewVideoUrls(shelves),
    appEvents: appEvents(shelves),
    featuredStories: featuredStories(shelves),
    editorsChoice: editorsChoice(shelves),
    accessibilityStatement: accessibilityStatement(shelves),
  };
}

function previewVideoUrls(shelves: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const [key, shelf] of Object.entries(shelves)) {
    if (!PRODUCT_MEDIA_KEY.test(key)) {
      continue;
    }
    for (const item of itemsOf(shelf)) {
      const url = nonEmptyString(asRecord(item.video)?.videoUrl);
      if (url !== null) {
        urls.push(url);
      }
    }
  }
  return urls;
}

function appEvents(shelves: Record<string, unknown>): PageAppEvent[] {
  return itemsOf(shelves.appEvents).flatMap((item) => {
    const appEventId = nonEmptyString(item.appEventId);
    if (appEventId === null) {
      return [];
    }
    return [
      {
        appEventId,
        title: nonEmptyString(item.title),
        kind: nonEmptyString(item.kind),
        badge: nonEmptyString(item.appEventBadgeKind),
        startsAt: nonEmptyString(item.startDate),
        endsAt: nonEmptyString(item.endDate),
      },
    ];
  });
}

function featuredStories(
  shelves: Record<string, unknown>,
): PageFeaturedStory[] {
  return itemsOf(shelves.featuredIn).map((item) => ({
    storyId: storyIdOf(item.clickAction),
    heading: nonEmptyString(item.heading),
    title: nonEmptyString(item.title),
  }));
}

function storyIdOf(clickAction: unknown): string | null {
  const pageUrl = nonEmptyString(asRecord(clickAction)?.pageUrl);
  const match = pageUrl === null ? null : STORY_ID.exec(pageUrl);
  return match === null ? null : match[1];
}

function editorsChoice(
  shelves: Record<string, unknown>,
): PageEditorsChoice | null {
  for (const item of itemsOf(shelves.editorsChoiceProductReviews)) {
    const review = asRecord(item.review);
    if (review !== null) {
      return {
        showsBadge: review.showsBadge === true,
        notes: nonEmptyString(review.notes),
      };
    }
  }
  return null;
}

function accessibilityStatement(
  shelves: Record<string, unknown>,
): string | null {
  for (const item of itemsOf(shelves.accessibilityHeader)) {
    const statement = nonEmptyString(
      asRecord(asRecord(item.text)?.styledText)?.rawText,
    );
    if (statement !== null) {
      return statement;
    }
  }
  return null;
}

function itemsOf(shelf: unknown): Record<string, unknown>[] {
  const items = asRecord(shelf)?.items;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const record = asRecord(item);
    return record === null ? [] : [record];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
