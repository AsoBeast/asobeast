export interface SeasonalDate {
  month: number;
  day: number;
}

export interface SeasonalEvent {
  id: string;
  name: string;
  start: SeasonalDate;
  end: SeasonalDate;
  keywords: string[];
}

export const SEASONAL_LEAD_DAYS = 14;

export const SEASONAL_CALENDAR: readonly SeasonalEvent[] = [
  {
    id: 'new-year',
    name: 'New Year',
    start: { month: 12, day: 26 },
    end: { month: 1, day: 7 },
    keywords: ['new year', 'resolution', 'goals', 'habit', 'fresh start'],
  },
  {
    id: 'valentines-day',
    name: "Valentine's Day",
    start: { month: 2, day: 1 },
    end: { month: 2, day: 14 },
    keywords: ['valentine', 'love', 'couples', 'romantic', 'gift'],
  },
  {
    id: 'spring-easter',
    name: 'Spring / Easter',
    start: { month: 3, day: 1 },
    end: { month: 4, day: 30 },
    keywords: ['spring', 'easter', 'refresh', 'clean', 'declutter'],
  },
  {
    id: 'mothers-day',
    name: "Mother's Day",
    start: { month: 5, day: 1 },
    end: { month: 5, day: 12 },
    keywords: ['mom', 'mother', 'family', 'gift for mom'],
  },
  {
    id: 'summer',
    name: 'Summer',
    start: { month: 6, day: 1 },
    end: { month: 8, day: 31 },
    keywords: ['summer', 'vacation', 'travel', 'outdoor', 'beach'],
  },
  {
    id: 'back-to-school',
    name: 'Back to School',
    start: { month: 7, day: 15 },
    end: { month: 9, day: 10 },
    keywords: ['school', 'study', 'student', 'homework', 'planner'],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    start: { month: 10, day: 1 },
    end: { month: 10, day: 31 },
    keywords: ['halloween', 'scary', 'spooky', 'costume', 'trick'],
  },
  {
    id: 'black-friday',
    name: 'Black Friday',
    start: { month: 11, day: 20 },
    end: { month: 11, day: 30 },
    keywords: ['deal', 'sale', 'discount', 'shopping', 'gift'],
  },
  {
    id: 'christmas',
    name: 'Christmas',
    start: { month: 12, day: 1 },
    end: { month: 12, day: 26 },
    keywords: ['christmas', 'gift', 'holiday', 'santa', 'family'],
  },
  {
    id: 'end-of-year',
    name: 'End of Year',
    start: { month: 12, day: 27 },
    end: { month: 12, day: 31 },
    keywords: ['year review', 'recap', 'goals 2026', 'new year'],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function inWindow(date: Date, event: SeasonalEvent, leadDays: number): boolean {
  const time = date.getTime();
  const year = date.getUTCFullYear();
  for (const y of [year - 1, year, year + 1]) {
    const start = Date.UTC(y, event.start.month - 1, event.start.day);
    let end = Date.UTC(y, event.end.month - 1, event.end.day, 23, 59, 59, 999);
    if (end < start) {
      end = Date.UTC(
        y + 1,
        event.end.month - 1,
        event.end.day,
        23,
        59,
        59,
        999,
      );
    }
    const windowStart = start - leadDays * DAY_MS;
    if (time >= windowStart && time <= end) {
      return true;
    }
  }
  return false;
}

export function activeSeasonalEvents(
  date: Date,
  leadDays = 0,
): SeasonalEvent[] {
  return SEASONAL_CALENDAR.filter((event) => inWindow(date, event, leadDays));
}
