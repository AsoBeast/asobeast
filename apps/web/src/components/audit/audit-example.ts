import type {
  AppAuditResult,
  AuditRecommendation,
  AuditTarget,
} from "@asobeast/shared";

const auditCheck = (
  id: string,
  label: string,
  status: AppAuditResult["factors"][number]["checks"][number]["status"],
  score: number | null,
  detail: string,
  extra: Partial<AppAuditResult["factors"][number]["checks"][number]> = {},
): AppAuditResult["factors"][number]["checks"][number] => ({
  id,
  label,
  kind: "auto",
  status,
  score,
  detail,
  weight: 2,
  source: "store",
  unlock: null,
  ...extra,
});

const auditFactor = (
  id: string,
  label: string,
  weight: number,
  score: number | null,
  group: "discoverability" | "conversion",
  checks: AppAuditResult["factors"][number]["checks"],
  extra: Partial<AppAuditResult["factors"][number]> = {},
): AppAuditResult["factors"][number] => ({
  id,
  label,
  weight,
  score,
  needsInput: score === null,
  checks,
  group,
  confidence: score === null ? 0 : 1,
  availability: score === null ? "awaiting-input" : "measured",
  ...extra,
});

const recommendation = (
  factorId: string,
  checkId: string,
  label: string,
  lift: number,
  effort: "minutes" | "hours" | "weeks",
  target: AuditTarget,
): AuditRecommendation => ({
  factorId,
  checkId,
  label,
  detail: `Evidence for ${checkId}.`,
  fix: `Change ${checkId} the way the rubric describes.`,
  effort,
  impact: lift >= 3 ? "high" : lift >= 1 ? "medium" : "low",
  lift,
  target,
});

const LIMITATIONS = [
  {
    id: "preview-video",
    label: "App previews",
    detail: "asobeast cannot see App Store previews.",
  },
  {
    id: "promotional-text",
    label: "Promotional text",
    detail: "Not in the data asobeast reads.",
  },
  {
    id: "review-replies",
    label: "Replies to reviews",
    detail: "The App Store review feed carries no developer replies.",
  },
];

const CREATIVE_SCREENSHOTS = [
  "Guess any place",
  "Play against friends",
  "Learn every flag",
  "Track your streak",
  "Beat the clock",
  "Climb the board",
].map((captionText, index) => ({
  position: index + 1,
  url: `https://is1-ssl.mzstatic.com/image/s${index + 1}.png`,
  captionText,
  captionReadable: true,
  captionLanguage: "en",
  message: index === 0 ? ("benefit" as const) : ("feature" as const),
  keywordHits: index === 0 ? ["geo quiz"] : [],
}));

export const APP_AUDIT_EXAMPLE: AppAuditResult = {
  appId: "app-1",
  store: "APP_STORE",
  overall: 71.8,
  coveredWeight: 90,
  totalWeight: 110,
  rubricVersion: "v2",
  grade: "B",
  confidence: 0.82,
  potential: 86.4,
  groups: [
    {
      id: "discoverability",
      label: "Search visibility",
      score: 6.4,
      confidence: 0.9,
    },
    { id: "conversion", label: "Conversion", score: 7.7, confidence: 0.75 },
  ],
  factors: [
    auditFactor(
      "title",
      "Title",
      20,
      9.1,
      "discoverability",
      [
        auditCheck(
          "title-keyword",
          "Primary keyword in title",
          "pass",
          10,
          "The title contains \u201cgeo quiz\u201d, a primary keyword.",
          { source: "keywords" },
        ),
        auditCheck(
          "title-length",
          "Character usage",
          "warn",
          6.7,
          "19 of 30 characters used.",
        ),
      ],
      { confidence: 0.875, availability: "partial" },
    ),
    auditFactor("subtitle", "Subtitle", 15, 4.2, "discoverability", [
      auditCheck(
        "subtitle-length",
        "Character usage",
        "fail",
        0,
        "0 of 30 characters used.",
      ),
    ]),
    auditFactor("keywordField", "Keyword field", 15, null, "discoverability", [
      auditCheck(
        "keyword-field-saved",
        "Keyword field",
        "unanswered",
        null,
        "No keyword field saved.",
        {
          source: "keywords",
          unlock: {
            kind: "keyword-field",
            label: "Paste your keyword field from App Store Connect",
          },
        },
      ),
    ]),
    auditFactor("description", "Description", 5, 8, "conversion", [
      auditCheck(
        "description-hook",
        "Strong opening hook",
        "pass",
        10,
        "The description opens with \u201cGuess where you are\u201d.",
        { kind: "heuristic" },
      ),
    ]),
    auditFactor("screenshots", "Screenshots", 15, 7.4, "conversion", [
      auditCheck(
        "screenshots-count",
        "All slots used",
        "pass",
        10,
        "8 of 8 recommended screenshots used.",
      ),
      auditCheck(
        "screenshots-captions",
        "Readable captions",
        "warn",
        6.7,
        "2 of the first 3 screenshots carry a readable caption.",
        { kind: "ai", source: "ai" },
      ),
    ]),
    auditFactor("previewVideo", "Preview video", 5, null, "conversion", [], {
      availability: "not-measurable",
      confidence: 0,
    }),
    auditFactor("ratings", "Ratings & reviews", 15, 8.2, "conversion", [
      auditCheck(
        "ratings-average",
        "Average rating",
        "pass",
        9.2,
        "Average rating is 4.60.",
      ),
    ]),
    auditFactor("icon", "Icon", 5, 8, "conversion", [
      auditCheck(
        "icon-no-text",
        "No text",
        "pass",
        10,
        "The icon contains no text.",
        {
          kind: "ai",
          source: "ai",
        },
      ),
    ]),
    auditFactor("rankings", "Keyword rankings", 10, 5.5, "discoverability", [
      auditCheck(
        "rankings-visibility",
        "Search visibility",
        "warn",
        5.5,
        "Visibility is 27.4.",
        { source: "rankings" },
      ),
    ]),
    auditFactor("conversion", "Freshness and trust", 5, 9, "conversion", [
      auditCheck(
        "conversion-update-recency",
        "Update recency",
        "pass",
        10,
        "The last update was 12 days ago.",
      ),
    ]),
  ],
  limitations: LIMITATIONS,
  unlocks: [
    {
      kind: "keyword-field",
      label: "Paste your keyword field from App Store Connect",
      checks: 1,
    },
  ],
  recommendations: {
    quickWins: [
      recommendation(
        "subtitle",
        "subtitle-length",
        "Add a subtitle",
        4.2,
        "minutes",
        "metadata",
      ),
      recommendation(
        "title",
        "title-length",
        "Use the 11 unused title characters",
        2.1,
        "minutes",
        "metadata",
      ),
    ],
    highImpact: [
      recommendation(
        "screenshots",
        "screenshots-captions",
        "Add readable captions to your first screenshots",
        1.8,
        "hours",
        "store-console",
      ),
    ],
    strategic: [
      recommendation(
        "rankings",
        "rankings-visibility",
        "Raise your search visibility",
        3.4,
        "weeks",
        "rankings",
      ),
    ],
  },
  creative: {
    analyzedAt: "2026-09-16T12:00:00.000Z",
    model: "gpt-5.6-luna",
    stale: false,
    icon: {
      url: "https://is1-ssl.mzstatic.com/image/icon.png",
      hasText: false,
      elementCount: "one",
      contrast: "high",
      similarCompetitor: null,
    },
    screenshots: CREATIVE_SCREENSHOTS,
  },
  benchmarks: {
    competitors: 3,
    rows: [
      {
        metric: "rating-count",
        label: "Ratings",
        better: "higher",
        you: 341,
        median: 300,
        best: 5200,
        bestAppId: "c1",
      },
      {
        metric: "screenshots",
        label: "Screenshots",
        better: "higher",
        you: 8,
        median: 6,
        best: 10,
        bestAppId: "c2",
      },
      {
        metric: "days-since-update",
        label: "Days since update",
        better: "lower",
        you: 12,
        median: 20,
        best: 5,
        bestAppId: "c1",
      },
    ],
  },
  ai: {
    configured: false,
    model: null,
    generatedAt: null,
    stale: false,
    run: null,
  },
  generatedAt: "2026-09-16T12:00:00.000Z",
};
