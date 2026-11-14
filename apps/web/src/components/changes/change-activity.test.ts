import { describe, expect, it } from "vitest";
import type { ChangeEventItem, ChangeField } from "@asobeast/shared";
import {
  activityLanes,
  changeLinesOn,
  changeWindowRange,
  markLabel,
  ownChangeDays,
  visibilityRows,
  windowDays,
} from "./change-activity";

const TODAY = "2026-11-12";

const event = (
  day: string,
  field: ChangeField,
  rival?: string,
): ChangeEventItem => ({
  id: `${day}-${field}-${rival ?? "own"}`,
  appId: rival ?? "app-1",
  appName: rival ? "Rival Focus" : "Focus Timer",
  isCompetitor: rival !== undefined,
  field,
  before: null,
  after: null,
  capturedAt: `${day}T12:00:00.000Z`,
});

describe("windowDays", () => {
  it("lists every day of the window, oldest first, ending today", () => {
    const days = windowDays(TODAY, 30);

    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-10-14");
    expect(days[29]).toBe(TODAY);
    expect(changeWindowRange(TODAY, 30)).toEqual({
      from: "2026-10-14",
      to: TODAY,
    });
  });
});

describe("visibilityRows", () => {
  it("leaves a day without a point empty", () => {
    const rows = visibilityRows(
      [{ date: "2026-11-11", visibility: 41 }],
      windowDays(TODAY, 3),
    );

    expect(rows).toEqual([
      { date: "2026-11-10", visibility: null },
      { date: "2026-11-11", visibility: 41 },
      { date: TODAY, visibility: null },
    ]);
  });
});

describe("activityLanes", () => {
  const events = [
    event("2026-11-11", "title"),
    event("2026-11-11", "description"),
    event("2026-11-11", "screenshots"),
    event("2026-11-08", "price", "comp-1"),
    event("2026-11-08", "whatsNew", "comp-1"),
    event("2026-11-08", "icon", "comp-1"),
    event("2026-11-02", "version", "comp-1"),
    event("2026-07-01", "title"),
  ];

  it("puts the own app first and one mark per day with its kinds", () => {
    const [own, rival] = activityLanes(events, windowDays(TODAY, 30));

    expect(own).toMatchObject({ own: true, count: 3 });
    expect(own.marks).toHaveLength(1);
    expect(own.marks[0].kinds).toEqual(["text", "visuals"]);
    expect(own.marks[0].position).toBeCloseTo(28 / 29);
    expect(rival).toMatchObject({ own: false, count: 4 });
    expect(rival.marks.map((mark) => mark.day)).toEqual([
      "2026-11-02",
      "2026-11-08",
    ]);
  });

  it("leaves out an event older than the window", () => {
    const [own] = activityLanes(events, windowDays(TODAY, 90));

    expect(own.count).toBe(3);
  });

  it("joins the days of a week into one mark on a year window", () => {
    const week = [
      event("2026-11-09", "title"),
      event("2026-11-06", "icon"),
      event("2026-07-01", "price"),
    ];
    const [own] = activityLanes(week, windowDays(TODAY, 365));

    expect(own.count).toBe(3);
    expect(own.marks).toHaveLength(2);
    const [older, newest] = own.marks;
    expect(older.day).toBe("2026-07-01");
    expect(newest).toMatchObject({
      from: "2026-11-06",
      day: "2026-11-09",
      kinds: ["text", "visuals"],
    });
    expect(newest.position).toBeCloseTo(361 / 364);
    expect(markLabel(own, newest)).toBe(
      "Nov 6 to Nov 9: you changed the title and icon",
    );
    expect(changeLinesOn([own], "2026-11-07")).toEqual([]);
    expect(changeLinesOn([own], "2026-11-06")).toEqual(["You: icon"]);
    expect(changeLinesOn([own], "2026-11-09")).toEqual(["You: title"]);
  });

  it("counts the fields of a mark that holds more than three", () => {
    const [own] = activityLanes(
      [
        event("2026-11-11", "title"),
        event("2026-11-11", "price"),
        event("2026-11-11", "icon"),
        event("2026-11-11", "version"),
      ],
      windowDays(TODAY, 30),
    );

    expect(markLabel(own, own.marks[0])).toBe("Nov 11: you changed 4 fields");
  });

  it("names a mark by its day, owner and fields", () => {
    const lanes = activityLanes(events, windowDays(TODAY, 30));

    expect(markLabel(lanes[0], lanes[0].marks[0])).toBe(
      "Nov 11: you changed the title, description, and screenshots",
    );
    expect(markLabel(lanes[1], lanes[1].marks[0])).toBe(
      "Nov 2: Rival Focus changed the version",
    );
    expect(changeLinesOn(lanes, "2026-11-08")).toEqual([
      "Rival Focus: price, what's new, and icon",
    ]);
  });

  it("marks only the days the own listing changed", () => {
    expect(ownChangeDays(events, windowDays(TODAY, 30))).toEqual([
      "2026-11-11",
    ]);
  });
});
