import type { Release } from "./release-notes";

export const LATER_RELEASES: readonly Release[] = [
  {
    version: "1.16.0",
    date: "2026-11-03",
    title: "Know what changed and connect your stores faster",
    summary:
      "AsoBeast now tells you when something new arrives and explains each update in plain words. Connecting App Store Connect or Google Play comes with a guide for every step.",
    changes: [
      {
        kind: "new",
        title: "What's New",
        text: "A What's New item at the bottom of the sidebar opens this page, and a red dot on its icon tells you when there is an update you have not read yet.",
      },
      {
        kind: "new",
        title: "Setup guides for store connections",
        text: "Each store card on the Integrations page links to a step by step guide that walks you from an empty console to a working connection.",
      },
      {
        kind: "improved",
        title: "A clearer sign up",
        text: "On the hosted service you confirm your email first, then pick a plan on one page that shows the price, what is included and the questions people ask most.",
      },
      {
        kind: "improved",
        title: "Start the free trial with a card",
        text: "On the hosted service the seven day trial starts once you add a card, and nothing is charged until the trial ends.",
      },
      {
        kind: "improved",
        title: "No competitor limit when you host it yourself",
        text: "A self hosted AsoBeast follows as many competitors as you like.",
      },
    ],
  },
  {
    version: "1.15.0",
    date: "2026-10-31",
    title: "See the whole results page and share your charts",
    summary:
      "Search results now go fifty deep with icons and movement, and every keyword shows its history in one click. Charts can be shared as pictures.",
    changes: [
      {
        kind: "new",
        title: "Top 50 search results",
        text: "The results of each keyword show the first fifty apps with their icons, how far each moved since the day before and which apps left the list.",
      },
      {
        kind: "new",
        title: "Position history in one click",
        text: "Press the history button beside a keyword's position to see how it moved over the last weeks without leaving the keywords page.",
      },
      {
        kind: "new",
        title: "Share a chart as a picture",
        text: "Copy or download any ranking chart as an image, with its title and legend, ready for a message or a slide.",
      },
      {
        kind: "new",
        title: "Bring your keywords from other tools",
        text: "Keyword files exported from Astro, Sonar and AppFollow import as they are, and a long file is imported in parts so nothing is lost.",
      },
      {
        kind: "new",
        title: "Import the keyword field from App Store Connect",
        text: "Turn it on for an app and AsoBeast reads its private keyword field from App Store Connect every time you ship a new version.",
      },
      {
        kind: "new",
        title: "More alerts",
        text: "Get told when a new review arrives with the stars you choose, and when your app enters or leaves a top chart. A drop in rank is only reported once the next check confirms it.",
      },
      {
        kind: "improved",
        title: "Ratings by market and more on the keywords page",
        text: "Compare your rating across countries, see when each keyword was added and which competitors sit in its top ten, and change many keywords at once.",
      },
    ],
  },
  {
    version: "1.14.0",
    date: "2026-10-25",
    title: "Your store numbers and replies, right next to your rankings",
    summary:
      "Connect App Store Connect or the Google Play Console to see how many people saw and installed your app. Replies to reviews can now be posted straight to the store.",
    changes: [
      {
        kind: "new",
        title: "Store funnel",
        text: "With a store connected, the app overview shows impressions, page views, downloads and conversion by country, taken from the store's own reports.",
      },
      {
        kind: "new",
        title: "Post review replies",
        text: "Write or draft a reply on the reviews page and send it to the App Store or Google Play with one press.",
      },
      {
        kind: "new",
        title: "Teams, Telegram and Google Chat",
        text: "Alerts can now be delivered to Microsoft Teams, Telegram and Google Chat, and reports in Discord, Slack and email show app icons and local times.",
      },
      {
        kind: "new",
        title: "Notes on your charts",
        text: "Mark a date on a ranking chart with a short note, such as a new version or a campaign, so you can see what happened around it.",
      },
      {
        kind: "improved",
        title: "Listing changes measured by conversion",
        text: "When a store is connected, each change to your listing also shows how conversion moved before and after it.",
      },
      {
        kind: "improved",
        title: "Know how fresh a position is",
        text: "A keyword whose position was not checked recently says the day it was last checked, and an app the store removed is clearly marked.",
      },
    ],
  },
  {
    version: "1.13.0",
    date: "2026-10-21",
    title: "Better keywords in Cyrillic and a table that remembers",
    summary:
      "Keywords in Russian and other Cyrillic languages are matched in all their word forms, and the keywords table keeps the order you chose.",
    changes: [
      {
        kind: "improved",
        title: "Word forms in Cyrillic",
        text: "A keyword written in one form now counts as covered when your listing uses another form of the same word.",
      },
      {
        kind: "improved",
        title: "Your sort is remembered",
        text: "The keywords table opens in the order you last sorted it.",
      },
      {
        kind: "fixed",
        title: "Steadier daily checks",
        text: "Several fixes make the daily ranking checks and the store reports more reliable.",
      },
    ],
  },
  {
    version: "1.12.0",
    date: "2026-10-19",
    title: "Understand why each app ranks",
    summary:
      "See which words in each listing explain its position for a keyword, and find new keywords around the phrases your competitors use.",
    changes: [
      {
        kind: "new",
        title: "Why each app ranks",
        text: "Open a keyword in the comparison table to see where the words appear in your listing and in each competitor's listing.",
      },
      {
        kind: "new",
        title: "Best position and time at the top",
        text: "Each tracked keyword shows the best position it reached and how many days it has held its current group.",
      },
      {
        kind: "new",
        title: "Suggestions from competitor phrases",
        text: "Keyword suggestions now include what people search around the phrases in your competitors' listings.",
      },
      {
        kind: "improved",
        title: "A tidier competitors page",
        text: "Sections of the competitors page fold away, and every comparison row shows and filters by its country.",
      },
    ],
  },
  {
    version: "1.11.0",
    date: "2026-10-16",
    title: "Top charts and smarter review tools",
    summary:
      "Follow the top charts of any country and category, and work through reviews faster with themes, translations and reply drafts.",
    changes: [
      {
        kind: "new",
        title: "Top charts",
        text: "See the free, paid and top grossing charts of any country and category side by side, with the apps that are rising fastest.",
      },
      {
        kind: "new",
        title: "Review themes and translation",
        text: "The reviews page shows the phrases people mention most, splits complaints from praise and translates a review into your language.",
      },
      {
        kind: "new",
        title: "Reply drafts",
        text: "Draft a reply to a review, copy it to the store and mark the review as replied, so you know what is still waiting.",
      },
      {
        kind: "new",
        title: "Find apps by name",
        text: "Search the store by name when you import an app, and get competitor suggestions based on who ranks next to you.",
      },
      {
        kind: "improved",
        title: "A guided setup that follows your goal",
        text: "Setting up a new app walks you through markets, keywords and competitors, and a progress pill shows how the first checks are going.",
      },
    ],
  },
  {
    version: "1.10.0",
    date: "2026-10-14",
    title: "One keyword field for every language",
    summary:
      "Keep an App Store keyword field for every language your app ships in, and let AsoBeast suggest the countries worth tracking.",
    changes: [
      {
        kind: "new",
        title: "A keyword field per language",
        text: "Edit the private App Store keyword field of each language on the metadata page, and see which countries read it.",
      },
      {
        kind: "new",
        title: "Country suggestions",
        text: "AsoBeast suggests countries from the languages your app supports and fills them with keywords from your listing.",
      },
      {
        kind: "improved",
        title: "Numbers for one country",
        text: "Choose a country on the app overview and every keyword number on the page follows it.",
      },
      {
        kind: "improved",
        title: "Clearer visibility and nicer emails",
        text: "The visibility score explains how it is calculated, and every email arrives in a clean, readable layout.",
      },
    ],
  },
];
