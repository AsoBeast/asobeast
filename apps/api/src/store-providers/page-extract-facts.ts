import {
  PageAppEvent,
  PageEditorsChoice,
  PageFeaturedStory,
} from './app-store-page';
import { isoDateOrNull } from '@asobeast/shared';
import { asRecord } from './record';

export interface PageExtractFacts {
  appEvents: PageAppEvent[];
  featuredStories: PageFeaturedStory[];
  editorsChoice: PageEditorsChoice | null;
}

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const eventOf = (item: unknown): PageAppEvent | null => {
  const record = asRecord(item);
  const appEventId = nonEmpty(record?.appEventId);
  if (record === null || appEventId === null) {
    return null;
  }
  return {
    appEventId,
    title: stringOrNull(record.title),
    kind: stringOrNull(record.kind),
    badge: stringOrNull(record.badge),
    startsAt: isoDateOrNull(record.startsAt),
    endsAt: isoDateOrNull(record.endsAt),
  };
};

const storyOf = (item: unknown): PageFeaturedStory | null => {
  const record = asRecord(item);
  if (record === null) {
    return null;
  }
  const story = {
    storyId: nonEmpty(record.storyId),
    heading: stringOrNull(record.heading),
    title: stringOrNull(record.title),
  };
  return story.storyId === null &&
    story.heading === null &&
    story.title === null
    ? null
    : story;
};

const editorsChoiceOf = (value: unknown): PageEditorsChoice | null => {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  return {
    showsBadge: record.showsBadge === true,
    notes: stringOrNull(record.notes),
  };
};

const narrowed = <T>(items: unknown[], of: (item: unknown) => T | null): T[] =>
  items.flatMap((item) => {
    const narrowedItem = of(item);
    return narrowedItem === null ? [] : [narrowedItem];
  });

export function pageExtractFacts(raw: unknown): PageExtractFacts | null {
  const extract = asRecord(asRecord(raw)?.pageExtract);
  if (extract === null) {
    return null;
  }
  return {
    appEvents: narrowed(list(extract.appEvents), eventOf),
    featuredStories: narrowed(list(extract.featuredStories), storyOf),
    editorsChoice: editorsChoiceOf(extract.editorsChoice),
  };
}
