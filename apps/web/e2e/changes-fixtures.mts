import type { ChangeEventItem, ChangeTimeline } from "@asobeast/shared";
import { utcTimestampDaysAgo } from "./fixtures.mts";

export const CHANGES_STATE_COOKIE = "e2e_changes_state";

export const LONG_TITLE =
  "Focus Timer Pro: Pomodoro, Deep Work Sessions, Study Planner And Habit Streaks For Busy Teams";

export const RTL_SUBTITLE = "مؤقت التركيز للدراسة والعمل العميق";

let sequence = 0;

function change(
  daysAgo: number,
  fields: Partial<ChangeEventItem> &
    Pick<ChangeEventItem, "field" | "before" | "after">,
): ChangeEventItem {
  sequence += 1;
  return {
    id: `chg-state-${sequence}`,
    appId: "app-1",
    appName: "Focus Timer",
    isCompetitor: false,
    capturedAt: utcTimestampDaysAgo(daysAgo),
    ...fields,
  };
}

const rival = (
  name: string,
  appId: string,
): Pick<ChangeEventItem, "appId" | "appName" | "isCompetitor"> => ({
  appId,
  appName: name,
  isCompetitor: true,
});

const BUSY: ChangeTimeline = {
  events: [
    change(1, { field: "title", before: "Focus Timer", after: LONG_TITLE }),
    change(1, {
      field: "subtitle",
      before: "Stay on task",
      after: RTL_SUBTITLE,
    }),
    change(1, { field: "description", before: "1840", after: "2210" }),
    change(1, { field: "version", before: "2.5.0", after: "2.6.0" }),
    change(1, { field: "price", before: "0", after: "2.99", currency: "USD" }),
    change(1, { field: "icon", before: null, after: null }),
    change(1, {
      field: "whatsNew",
      before: "v2.5\n- Fixes",
      after: "v2.6\n- Widgets\n- Faster start",
    }),
    change(1, { field: "screenshots", before: "4", after: "6" }),
    change(1, {
      ...rival("Rival Focus", "comp-1"),
      field: "title",
      before: "Rival Focus",
      after: "Rival Focus: Pomodoro",
    }),
    change(1, {
      ...rival("Rival Focus", "comp-1"),
      field: "price",
      before: "4.99",
      after: "0",
      currency: "USD",
    }),
    change(1, {
      ...rival("Deep Work Clock", "comp-2"),
      field: "subtitle",
      before: "Timer",
      after: "Timer and planner",
    }),
    change(9, { field: "version", before: "2.4.0", after: "2.5.0" }),
    change(20, { field: "version", before: "2.3.0", after: "2.4.0" }),
    change(2, {
      ...rival("Deep Work Clock", "comp-2"),
      field: "version",
      before: "1.2",
      after: "1.3",
    }),
    change(9, {
      ...rival("Deep Work Clock", "comp-2"),
      field: "version",
      before: "1.1",
      after: "1.2",
    }),
    change(20, {
      ...rival("Deep Work Clock", "comp-2"),
      field: "version",
      before: "1.0",
      after: "1.1",
    }),
  ],
};

const COMPETITORS_ONLY: ChangeTimeline = {
  events: BUSY.events.filter((event) => event.isCompetitor),
};

const PLAY: ChangeTimeline = {
  events: [
    {
      id: "chg-play-1",
      appId: "app-gp",
      appName: "Word Garden",
      isCompetitor: false,
      field: "summary",
      before: "Grow your vocabulary",
      after: "Grow your vocabulary one word a day",
      capturedAt: utcTimestampDaysAgo(3),
    },
    {
      id: "chg-play-2",
      appId: "app-gp",
      appName: "Word Garden",
      isCompetitor: false,
      field: "description",
      before: "1200",
      after: "1480",
      capturedAt: utcTimestampDaysAgo(3),
    },
  ],
};

const STATES: Record<string, ChangeTimeline> = {
  busy: BUSY,
  competitors: COMPETITORS_ONLY,
  play: PLAY,
};

export const changesState = (
  state: string | undefined,
): ChangeTimeline | undefined => (state ? STATES[state] : undefined);
