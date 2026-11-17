import {
  AppEventRef,
  AppEventsDetail,
  EditorsChoiceDetail,
  FeaturingDetail,
  StoryRef,
} from '@asobeast/shared';
import {
  PageAppEvent,
  PageEditorsChoice,
  PageFeaturedStory,
} from '../store-providers/app-store-page';
import { PageExtractFacts } from '../store-providers/page-extract-facts';
import { DetectedChange } from './change-detector';

interface Keyed<T> {
  id: string;
  item: T;
}

const keyed = <T>(items: T[], idOf: (item: T) => string | null): Keyed<T>[] => {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const id = idOf(item);
    if (id === null || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [{ id, item }];
  });
};

function diffKeyed<T>(
  prev: Keyed<T>[],
  next: Keyed<T>[],
): { added: Keyed<T>[]; removed: Keyed<T>[] } {
  const prevIds = new Set(prev.map(({ id }) => id));
  const nextIds = new Set(next.map(({ id }) => id));
  return {
    added: next.filter(({ id }) => !prevIds.has(id)),
    removed: prev.filter(({ id }) => !nextIds.has(id)),
  };
}

const appEventRef = ({ id, item }: Keyed<PageAppEvent>): AppEventRef => ({
  appEventId: id,
  title: item.title,
  kind: item.kind,
  badge: item.badge,
  startsAt: item.startsAt,
  endsAt: item.endsAt,
});

const storyRef = ({ id, item }: Keyed<PageFeaturedStory>): StoryRef => ({
  storyId: id,
  heading: item.heading,
  title: item.title,
});

function eventsChange(
  prev: PageAppEvent[],
  next: PageAppEvent[],
): DetectedChange[] {
  const { added, removed } = diffKeyed(
    keyed(prev, (event) => event.appEventId),
    keyed(next, (event) => event.appEventId),
  );
  if (added.length === 0 && removed.length === 0) {
    return [];
  }
  const detail: AppEventsDetail = {
    kind: 'events',
    added: added.map(appEventRef),
    removed: removed.map(appEventRef),
  };
  return [{ field: 'inAppEvents', before: null, after: null, detail }];
}

function featuringChange(
  prev: PageFeaturedStory[],
  next: PageFeaturedStory[],
): DetectedChange[] {
  const { added, removed } = diffKeyed(
    keyed(prev, (story) => story.storyId),
    keyed(next, (story) => story.storyId),
  );
  if (added.length === 0 && removed.length === 0) {
    return [];
  }
  const detail: FeaturingDetail = {
    kind: 'featuring',
    added: added.map(storyRef),
    removed: removed.map(storyRef),
  };
  return [{ field: 'featuring', before: null, after: null, detail }];
}

const showsBadge = (choice: PageEditorsChoice | null): boolean =>
  choice?.showsBadge === true;

function editorsChoiceChange(
  prev: PageEditorsChoice | null,
  next: PageEditorsChoice | null,
): DetectedChange[] {
  if (showsBadge(prev) === showsBadge(next)) {
    return [];
  }
  const detail: EditorsChoiceDetail = {
    kind: 'editorsChoice',
    showsBadge: showsBadge(next),
    notes: next === null ? null : next.notes,
  };
  return [{ field: 'editorsChoice', before: null, after: null, detail }];
}

export function detectExtractChanges(
  prev: PageExtractFacts | null,
  next: PageExtractFacts | null,
): DetectedChange[] {
  if (prev === null || next === null) {
    return [];
  }
  return [
    ...eventsChange(prev.appEvents, next.appEvents),
    ...featuringChange(prev.featuredStories, next.featuredStories),
    ...editorsChoiceChange(prev.editorsChoice, next.editorsChoice),
  ];
}
