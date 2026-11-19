import * as cheerio from 'cheerio';
import { isoDateOrNull } from '@asobeast/shared';
import { asRecord } from './record';

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

export interface PageSimilarItem {
  adamId: string;
  title: string;
  subtitle: string | null;
  developer: string | null;
  rating: number | null;
  ratingCount: string | null;
  iconTemplate: string | null;
}

export interface AppStorePageExtract {
  previewVideoUrls: string[] | null;
  appEvents: PageAppEvent[];
  featuredStories: PageFeaturedStory[];
  editorsChoice: PageEditorsChoice | null;
  accessibilityStatement: string | null;
}

const SERVER_DATA_SELECTOR = 'script#serialized-server-data';

const PRODUCT_MEDIA_KEY = /^product_media_/;

const STORY_ID = /\/story\/id(\d+)/;

const NUMERIC_ADAM_ID = /^\d+$/;

const SIMILAR_SHELF_KEY = 'similarItems';

const SIMILAR_DOWNLOADING_SHELF_KEY = 'similarItemsDownloading';

export function parseAppStorePage(html: string): AppStorePageExtract {
  return parseAppStorePageDocument(cheerio.load(html));
}

export function parseAppStorePageDocument(
  document: cheerio.CheerioAPI,
): AppStorePageExtract {
  return readShelves(shelfMappingOf(document));
}

export function parseSimilarItems(html: string): PageSimilarItem[] {
  const shelves = shelfMappingOf(cheerio.load(html));
  const primary = similarLockupsOf(shelves[SIMILAR_SHELF_KEY]);
  return primary.length > 0
    ? primary
    : similarLockupsOf(shelves[SIMILAR_DOWNLOADING_SHELF_KEY]);
}

function shelfMappingOf(document: cheerio.CheerioAPI): Record<string, unknown> {
  const embedded = document(SERVER_DATA_SELECTOR).first().html();
  if (embedded === null || embedded.trim().length === 0) {
    throw new Error('product page embeds no serialized server data');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(embedded);
  } catch {
    throw new Error('serialized server data is not valid JSON');
  }
  const mapping = shelfMappingIn(parsed);
  if (mapping === null) {
    throw new Error('serialized server data carries no shelf mapping');
  }
  return mapping;
}

function shelfMappingIn(parsed: unknown): Record<string, unknown> | null {
  const entries = asRecord(parsed)?.data;
  if (!Array.isArray(entries)) {
    return null;
  }
  for (const entry of entries) {
    const mapping = asRecord(asRecord(asRecord(entry)?.data)?.shelfMapping);
    if (mapping !== null) {
      return mapping;
    }
  }
  return null;
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

function previewVideoUrls(shelves: Record<string, unknown>): string[] | null {
  const urls: string[] = [];
  let mediaShelves = 0;
  for (const [key, shelf] of Object.entries(shelves)) {
    if (!PRODUCT_MEDIA_KEY.test(key) || !hasItemArray(shelf)) {
      continue;
    }
    mediaShelves += 1;
    for (const item of itemsOf(shelf)) {
      const url = nonEmptyString(asRecord(item.video)?.videoUrl);
      if (url !== null) {
        urls.push(url);
      }
    }
  }
  return mediaShelves === 0 ? null : [...new Set(urls)];
}

function hasItemArray(shelf: unknown): boolean {
  return Array.isArray(asRecord(shelf)?.items);
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
        startsAt: isoDateOrNull(item.startDate),
        endsAt: isoDateOrNull(item.endDate),
      },
    ];
  });
}

function featuredStories(
  shelves: Record<string, unknown>,
): PageFeaturedStory[] {
  return itemsOf(shelves.featuredIn).flatMap((item) => {
    const story = {
      storyId: storyIdOf(item.clickAction),
      heading: nonEmptyString(item.heading),
      title: nonEmptyString(item.title),
    };
    return story.storyId === null &&
      story.heading === null &&
      story.title === null
      ? []
      : [story];
  });
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

function similarLockupsOf(shelf: unknown): PageSimilarItem[] {
  return itemsOf(shelf).flatMap((item) => {
    const adamId = nonEmptyString(item.adamId);
    const title = nonEmptyString(item.title);
    if (adamId === null || !NUMERIC_ADAM_ID.test(adamId) || title === null) {
      return [];
    }
    return [
      {
        adamId,
        title,
        subtitle: nonEmptyString(item.subtitle),
        developer: nonEmptyString(item.developerName),
        rating: finiteNumber(item.rating),
        ratingCount: nonEmptyString(item.ratingCount),
        iconTemplate: nonEmptyString(asRecord(item.icon)?.template),
      },
    ];
  });
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
