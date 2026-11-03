import type { Release } from "./release-notes";

export const FIRST_RELEASES: readonly Release[] = [
  {
    version: "1.9.0",
    date: "2026-10-10",
    title: "Every country gets its own listing",
    summary:
      "AsoBeast now keeps your listing for each country you track, reads the text on your screenshots and imports keywords from a spreadsheet.",
    changes: [
      {
        kind: "new",
        title: "Listings per country",
        text: "Switch between countries on an app to see the listing people there actually get, and track its changes.",
      },
      {
        kind: "new",
        title: "Import keywords from a file",
        text: "Upload a spreadsheet of keywords and AsoBeast shows what it will add before anything changes.",
      },
      {
        kind: "new",
        title: "Screenshot text",
        text: "The words printed on your App Store screenshots are read on your own server and shown beside your keyword coverage.",
      },
      {
        kind: "new",
        title: "Let your AI assistant make changes",
        text: "With a token that allows it, an AI assistant connected to AsoBeast can track keywords, add competitors and update actions for you.",
      },
      {
        kind: "improved",
        title: "A fresh look",
        text: "AsoBeast has a new name style and its orange brand colour across the app.",
      },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-10-06",
    title: "Clear limits for AI features",
    summary:
      "AI features now count against a monthly allowance you can see, so there are no surprises.",
    changes: [
      {
        kind: "new",
        title: "Monthly AI allowance",
        text: "Settings show how many AI requests your workspace has used this month and how many are left.",
      },
      {
        kind: "new",
        title: "Admin area",
        text: "Whoever runs the instance gets an admin area with an overview of workspaces, users and capacity.",
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-10-01",
    title: "A dashboard built around decisions",
    summary:
      "The dashboard and the Action Center were redesigned to show what needs your attention first, and keywords gained tags and notes.",
    changes: [
      {
        kind: "new",
        title: "A new dashboard and Action Center",
        text: "Start the day with what changed and what to do next, then work through suggested actions and see what each one achieved.",
      },
      {
        kind: "new",
        title: "Tags and notes",
        text: "Tag keywords to group them and keep a note on each.",
      },
      {
        kind: "new",
        title: "Milestone alerts",
        text: "Get told when a keyword reaches the top ten, ranks for the first time or passes a competitor.",
      },
      {
        kind: "new",
        title: "What a change did",
        text: "Each listing change shows how your rankings and visibility moved in the days after it.",
      },
      {
        kind: "new",
        title: "Exports and printable reports",
        text: "Export competitors, gaps, reviews and search results to a spreadsheet, and print the overview and rankings as a report.",
      },
      {
        kind: "improved",
        title: "Keyword ideas from your listing",
        text: "AsoBeast lists the word combinations your listing already covers, and shows the extra languages each country also searches.",
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-09-24",
    title: "Tables you can sort, filter and read at a glance",
    summary:
      "Every table in AsoBeast can now be sorted and filtered, and scores are coloured by how good they are.",
    changes: [
      {
        kind: "improved",
        title: "Sort and filter everything",
        text: "Sort any column, filter by what you need and hide the columns you do not use.",
      },
      {
        kind: "improved",
        title: "Scores in colour and words",
        text: "Scores, positions and ratings are marked strong, fair, weak or poor, in colour and in words.",
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-09-22",
    title: "Keyword scores you can trust",
    summary:
      "Popularity and difficulty were rebuilt from what the stores actually show, and each score now explains where it comes from.",
    changes: [
      {
        kind: "improved",
        title: "Better popularity",
        text: "Popularity is estimated from the store's own search suggestions and, when available, from Apple's official popularity.",
      },
      {
        kind: "improved",
        title: "Honest difficulty",
        text: "Difficulty looks at how strong the apps in the results really are, and flags results led by a big brand.",
      },
      {
        kind: "new",
        title: "Score details",
        text: "Open a score to see the signals behind it and how confident AsoBeast is.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-09-18",
    title: "A rebuilt ASO audit with a plan",
    summary:
      "The audit now gives your listing a score, a grade and a ranked plan of what to fix first, and compares you with your competitors.",
    changes: [
      {
        kind: "new",
        title: "Score, grade and action plan",
        text: "Each check explains what it found, and the plan lists fixes by how much they help and how much work they take.",
      },
      {
        kind: "new",
        title: "Compare with competitors",
        text: "See how your title, ratings and screenshots stand against the apps you compete with.",
      },
      {
        kind: "new",
        title: "AI review of your icon and screenshots",
        text: "With AI turned on, AsoBeast looks at your icon and screenshots and tells you what it notices.",
      },
      {
        kind: "new",
        title: "Connect any AI assistant",
        text: "The Integrations page gives ready to paste setup for Claude, Codex, Cursor, VS Code, Windsurf, Gemini and other assistants.",
      },
      {
        kind: "improved",
        title: "Google Play replies",
        text: "Replies you wrote on Google Play reviews now show next to the review.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-09-13",
    title: "Know which version you run",
    summary:
      "The bottom of the sidebar shows the version of AsoBeast you are using.",
    changes: [
      {
        kind: "new",
        title: "Version in the sidebar",
        text: "The version number at the bottom of the sidebar opens its technical release notes.",
      },
      {
        kind: "fixed",
        title: "Smoother checkout",
        text: "Coming back from a payment now updates your plan right away.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-29",
    title: "Know when something needs time or attention",
    summary:
      "A new app shows what it is still waiting for, and AsoBeast warns you if a store changes in a way that stops data from coming in.",
    changes: [
      {
        kind: "new",
        title: "First results timeline",
        text: "After importing an app you see each first check as it finishes, and suggested actions are ready right away.",
      },
      {
        kind: "new",
        title: "Store health notice",
        text: "If a store changes and AsoBeast cannot read it for a while, a notice says so at the top of every page.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-08-26",
    title: "Small improvements after launch",
    summary:
      "A few refinements to keywords and competitors after the first release.",
    changes: [
      {
        kind: "improved",
        title: "Your saved keyword field",
        text: "The App Store keyword field you saved shows wherever AsoBeast reads your keywords.",
      },
      {
        kind: "improved",
        title: "Store names on suggestions",
        text: "Suggested competitors say which store they come from.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-24",
    title: "AsoBeast is here",
    summary:
      "The first release of AsoBeast, an open source toolkit to grow your app in the App Store and on Google Play.",
    changes: [
      {
        kind: "new",
        title: "Track keywords and rankings",
        text: "Import an app from its store link, track the keywords that matter and see where you rank every day, in every country you choose.",
      },
      {
        kind: "new",
        title: "Watch your competitors",
        text: "Follow competing apps, compare rankings side by side and get told when their listing changes.",
      },
      {
        kind: "new",
        title: "Scores, audits and alerts",
        text: "Every keyword gets popularity, difficulty and opportunity scores, your listing gets an audit, and alerts reach you by email or webhook.",
      },
    ],
  },
];
