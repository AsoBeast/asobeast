import type { AppAnnotationItem, SerpMovers } from "@asobeast/shared";
import { utcDaysAgo } from "./fixtures.mts";

export const RANKINGS_EDGE_COOKIE = "e2e-rankings-edge";

export const LONG_ENTRANT_TITLE =
  "Pomodoro Focus Timer and Study Planner for Deep Work Sessions";

export const RTL_ENTRANT_KEYWORD = "مؤقت التركيز";

export const windowAnnotations = (): AppAnnotationItem[] => [
  {
    id: "annotation-window-1",
    appId: "app-1",
    date: utcDaysAgo(3),
    label: "Release 5.20.0",
    market: null,
    tag: "release",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "annotation-window-2",
    appId: "app-1",
    date: utcDaysAgo(6),
    label:
      "Autumn campaign with a label long enough to wrap onto a second line",
    market: "de",
    tag: "campaign",
    createdAt: "2026-10-05T09:00:00.000Z",
  },
];

export const edgeSerpMovers = (): SerpMovers => ({
  windowDays: 7,
  items: [
    {
      date: utcDaysAgo(1),
      keywordId: "kw-1",
      text: "focus timer",
      position: 3,
      storeAppId: "123456789",
      title: "Focus Timer",
      appId: "app-1",
      isCompetitor: false,
    },
    {
      date: utcDaysAgo(1),
      keywordId: "kw-2",
      text: RTL_ENTRANT_KEYWORD,
      position: 7,
      storeAppId: "rtl-store",
      title: "مؤقت بومودورو",
      appId: null,
      isCompetitor: false,
    },
    {
      date: utcDaysAgo(2),
      keywordId: "kw-3",
      text: "study timer for students preparing for long exams",
      position: 9,
      storeAppId: "long-store",
      title: LONG_ENTRANT_TITLE,
      appId: null,
      isCompetitor: false,
    },
  ],
});
