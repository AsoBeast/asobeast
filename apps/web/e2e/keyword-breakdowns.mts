import type {
  KeywordBreakdown,
  KeywordBreakdownApp,
  KeywordBreakdownField,
  KeywordBreakdownListing,
  KeywordBreakdownSegment,
  KeywordPlacement,
  KeywordWordMatch,
  LocalizationReadRole,
  MetadataField,
} from "@asobeast/shared";

type Marks = Readonly<Record<string, KeywordWordMatch>>;

const PHRASE_FIELDS: readonly MetadataField[] = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
];

const fold = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

function segmentsOf(text: string, marks: Marks): KeywordBreakdownSegment[] {
  const found = Object.entries(marks)
    .map(([surface, match]) => ({ at: text.indexOf(surface), surface, match }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at);
  const segments: KeywordBreakdownSegment[] = [];
  let cursor = 0;
  for (const { at, surface, match } of found) {
    if (at > cursor)
      segments.push({ text: text.slice(cursor, at), match: "none" });
    segments.push({ text: surface, match });
    cursor = at + surface.length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: "none" });
  }
  return segments;
}

function breakdownField(
  field: MetadataField,
  text: string,
  words: readonly string[],
  marks: Marks = {},
): KeywordBreakdownField {
  const matches = words.map((word) => ({
    word,
    match:
      Object.entries(marks).find(([surface]) => fold(surface) === word)?.[1] ??
      ("none" as KeywordWordMatch),
  }));
  return {
    field,
    phrase:
      matches.every(({ match }) => match === "exact") &&
      text.toLowerCase().includes(words.join(" ")),
    words: matches,
    segments: field === "description" ? null : segmentsOf(text, marks),
  };
}

function placementOf(
  fields: readonly KeywordBreakdownField[],
): KeywordPlacement {
  const phrase = PHRASE_FIELDS.find((name) =>
    fields.some((field) => field.field === name && field.phrase),
  );
  if (phrase) return phrase as KeywordPlacement;
  const total = fields[0]?.words.length ?? 0;
  const found = Array.from({ length: total }, (_, index) =>
    fields.some((field) => field.words[index]?.match === "exact"),
  ).filter(Boolean).length;
  if (total > 0 && found === total) return "split";
  return found > 0 ? "partial" : "none";
}

function listing(
  localization: string | null,
  role: LocalizationReadRole | null,
  fields: KeywordBreakdownField[],
): KeywordBreakdownListing {
  return { localization, role, fields, placement: placementOf(fields) };
}

const STRENGTH: readonly KeywordPlacement[] = [
  "none",
  "partial",
  "split",
  "description",
  "keywordField",
  "subtitle",
  "title",
];

const bestOf = (listings: readonly KeywordBreakdownListing[]) =>
  listings.reduce<KeywordPlacement>(
    (best, { placement }) =>
      STRENGTH.indexOf(placement) > STRENGTH.indexOf(best) ? placement : best,
    "none",
  );

const CHECKED_ON = "2026-07-30";

function app(
  overrides: Partial<KeywordBreakdownApp> &
    Pick<KeywordBreakdownApp, "appId" | "name" | "listings">,
): KeywordBreakdownApp {
  return {
    iconUrl: null,
    isYou: false,
    ranking: null,
    listingCountry: "us",
    capturedAt: "2026-07-30T03:00:00.000Z",
    unread: [],
    placement: bestOf(overrides.listings),
    rating: { average: 4.5, count: 1200, country: "us" },
    insight: null,
    ...overrides,
  };
}

const at = (position: number | null) => ({
  ranking: { position, depth: 200, date: CHECKED_ON },
});

const YOU = { appId: "app-1", name: "Focus Timer", isYou: true };
const RIVAL = { appId: "comp-1", name: "Rival Focus" };

const standing = (
  overrides: Partial<KeywordBreakdown["standing"]> = {},
): KeywordBreakdown["standing"] => ({
  checked: true,
  above: 0,
  competitors: 1,
  missingWords: [],
  foldedWords: [],
  recentChange: null,
  ...overrides,
});

const english = (fields: KeywordBreakdownField[]) =>
  listing("en-US", "default", fields);

function focusTimer(): KeywordBreakdown {
  const words = ["focus", "timer"];
  return {
    keywordId: "kw-1",
    text: "focus timer",
    store: "APP_STORE",
    country: "us",
    words,
    standing: standing(),
    apps: [
      app({
        ...YOU,
        ...at(3),
        listings: [
          english([
            breakdownField("title", "Focus Timer", words, {
              Focus: "exact",
              Timer: "exact",
            }),
            breakdownField("subtitle", "Deep work sessions", words),
            breakdownField("keywordField", "pomodoro, focus", words, {
              focus: "exact",
            }),
          ]),
        ],
      }),
      app({
        ...RIVAL,
        ...at(9),
        listings: [
          english([
            breakdownField("title", "Rival Focus", words, { Focus: "exact" }),
            breakdownField("subtitle", "Deep focus timer", words, {
              focus: "exact",
              timer: "exact",
            }),
          ]),
        ],
        unread: ["es-MX"],
      }),
    ],
  };
}

function pomodoro(): KeywordBreakdown {
  const words = ["pomodoro"];
  return {
    keywordId: "kw-2",
    text: "pomodoro",
    store: "APP_STORE",
    country: "us",
    words,
    standing: standing({ above: 1 }),
    apps: [
      app({
        ...YOU,
        ...at(12),
        rating: { average: 4.2, count: 300, country: "us" },
        listings: [
          english([
            breakdownField("title", "Focus Timer", words),
            breakdownField("subtitle", "Pomodóro sessions", words, {
              Pomodóro: "folded",
            }),
            breakdownField("keywordField", "pomodoro, focus", words, {
              pomodoro: "exact",
            }),
          ]),
          listing("es-MX", "additional", [
            breakdownField("title", "Temporizador", words),
            breakdownField("subtitle", "Sesiones de trabajo", words),
          ]),
        ],
      }),
      app({
        ...RIVAL,
        ...at(4),
        rating: { average: 4.7, count: 12000, country: "us" },
        unread: ["es-MX"],
        insight: { rule: "placement", theirs: "title", yours: "keywordField" },
        listings: [
          english([
            breakdownField("title", "Pomodoro Rival", words, {
              Pomodoro: "exact",
            }),
            breakdownField("subtitle", "Deep focus timer", words),
          ]),
        ],
      }),
    ],
  };
}

function productivityApp(): KeywordBreakdown {
  const words = ["productivity", "app"];
  return {
    keywordId: "kw-4",
    text: "productivity app",
    store: "APP_STORE",
    country: "us",
    words,
    standing: standing({ above: 1, missingWords: ["productivity", "app"] }),
    apps: [
      app({
        ...YOU,
        ...at(null),
        listings: [
          english([
            breakdownField("title", "Focus Timer", words),
            breakdownField("subtitle", "Deep work sessions", words),
            breakdownField("keywordField", "", words),
          ]),
        ],
      }),
      app({
        ...RIVAL,
        ...at(8),
        insight: { rule: "hidden" },
        listings: [
          english([
            breakdownField("title", "Rival Focus", words),
            breakdownField("subtitle", "Deep focus timer", words),
          ]),
        ],
      }),
    ],
  };
}

function timeBlocking(): KeywordBreakdown {
  const words = ["time", "blocking"];
  return {
    keywordId: "kw-5",
    text: "time blocking",
    store: "APP_STORE",
    country: "us",
    words,
    standing: standing({ missingWords: ["blocking"] }),
    apps: [
      app({
        ...YOU,
        ...at(45),
        listings: [
          english([
            breakdownField("title", "Focus Timer", words),
            breakdownField("subtitle", "Time well spent", words, {
              Time: "exact",
            }),
          ]),
        ],
      }),
      app({
        ...RIVAL,
        ranking: null,
        listings: [
          english([
            breakdownField("title", "Rival Focus", words),
            breakdownField("subtitle", "Deep focus timer", words),
          ]),
        ],
      }),
    ],
  };
}

function germanPomodoro(): KeywordBreakdown {
  const words = ["pomodoro"];
  const german = (fields: KeywordBreakdownField[]) =>
    listing("de", "default", fields);
  return {
    keywordId: "kw-de-1",
    text: "pomodoro",
    store: "APP_STORE",
    country: "de",
    words,
    standing: standing({ above: 1 }),
    apps: [
      app({
        ...YOU,
        ...at(7),
        listingCountry: "de",
        rating: { average: 4.4, count: 40, country: "de" },
        listings: [
          german([
            breakdownField("title", "Fokus Timer", words),
            breakdownField("subtitle", "Pomodoro Sitzungen", words, {
              Pomodoro: "exact",
            }),
          ]),
        ],
      }),
      app({
        ...RIVAL,
        ...at(2),
        listingCountry: "us",
        rating: { average: 4.7, count: 12000, country: "us" },
        insight: { rule: "similar" },
        listings: [
          german([
            breakdownField("title", "Rival Focus", words),
            breakdownField("subtitle", "Pomodoro and deep work", words, {
              Pomodoro: "exact",
            }),
          ]),
        ],
      }),
    ],
  };
}

function playPomodoroTimer(): KeywordBreakdown {
  const words = ["pomodoro", "timer"];
  const play = (fields: KeywordBreakdownField[]) => listing(null, null, fields);
  return {
    keywordId: "kw-gp-1",
    text: "pomodoro timer",
    store: "GOOGLE_PLAY",
    country: "de",
    words,
    standing: standing(),
    apps: [
      app({
        appId: "app-gp",
        name: "Tomato Clock",
        isYou: true,
        ...at(5),
        listingCountry: "de",
        rating: { average: 4.3, count: 820, country: "de" },
        listings: [
          play([
            breakdownField("title", "Tomato Clock", words),
            breakdownField(
              "shortDescription",
              "Fokus Timer für Pomodoro Sessions",
              words,
              { Timer: "exact", Pomodoro: "exact" },
            ),
            breakdownField(
              "description",
              "Der Pomodoro Timer für jeden Tag",
              words,
              { Pomodoro: "exact", Timer: "exact" },
            ),
          ]),
        ],
      }),
      app({
        appId: "comp-gp-1",
        name: "Tiefenfokus",
        ...at(11),
        listingCountry: "de",
        rating: { average: 4.1, count: 300, country: "de" },
        listings: [play([breakdownField("title", "Tiefenfokus", words)])],
      }),
    ],
  };
}

const byKeyword = (breakdowns: KeywordBreakdown[]) =>
  Object.fromEntries(breakdowns.map((entry) => [entry.keywordId, entry]));

export const BREAKDOWNS: Record<string, Record<string, KeywordBreakdown>> = {
  "app-1": byKeyword([
    focusTimer(),
    pomodoro(),
    productivityApp(),
    timeBlocking(),
    germanPomodoro(),
  ]),
  "app-gp": byKeyword([playPomodoroTimer()]),
};
