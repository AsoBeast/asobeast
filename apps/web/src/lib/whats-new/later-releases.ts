import type { Release } from "./release-notes";

export const LATER_RELEASES: readonly Release[] = [
  {
    version: "1.16.1",
    date: "2026-11-08",
    title: "Clearer sign up and billing",
    summary:
      "Signing up and paying now say exactly what you agree to and what you will be charged, and a trial that cannot run never costs you anything.",
    changes: [
      {
        kind: "improved",
        title: "Terms at sign up",
        text: "Creating an account now names the Terms of Service and the Privacy Policy, and both are linked from the sidebar and the plan page.",
      },
      {
        kind: "improved",
        title: "What you pay, stated in full",
        text: "The plan page and the trial emails now state the price, the billing period, that tax is added and that the plan renews until you cancel.",
      },
      {
        kind: "fixed",
        title: "No charge when a trial cannot start",
        text: "A card or email that already had a free trial is no longer charged by surprise. The trial is cancelled, nothing is charged, and you are told why and offered a plan.",
      },
      {
        kind: "fixed",
        title: "A reminder three days before the first charge",
        text: "The reminder before your first charge now arrives at least three days ahead, and its subject says how long is left.",
      },
      {
        kind: "fixed",
        title: "Deleting a workspace stops the next charge",
        text: "Asking to delete a workspace now stops any further charge on a paid plan as well as on a trial, and cancelling the deletion starts the renewal again.",
      },
    ],
  },
  {
    version: "1.16.0",
    date: "2026-11-03",
    title: "Find new keywords and know what changed",
    summary:
      "AsoBeast now finds the keywords your app already ranks for, shows where competitors beat you and lists what the daily run noticed on one page. Each update is explained in plain words, and connecting App Store Connect or Google Play comes with a guide for every step.",
    changes: [
      {
        kind: "new",
        title: "What's New",
        text: "A What's New item at the bottom of the sidebar opens this page, and a red dot on its icon tells you when there is an update you have not read yet.",
      },
      {
        kind: "new",
        title: "Setup checklist",
        text: "A small pill at the bottom right of every page counts what is left to set up, such as a second market, a competitor or an alert, and opens a list that links straight to each step and to features worth knowing beside it. Tell AsoBeast what you want to get done and the list starts with what matters most. Hide it for your workspace and bring it back under Settings.",
      },
      {
        kind: "new",
        title: "Setup guides for store connections",
        text: "Each store card on the Integrations page links to a step by step guide that walks you from an empty console to a working connection.",
      },
      {
        kind: "new",
        title: "Opportunity map",
        text: "Switch the keywords page to Map to see every keyword placed by popularity and difficulty, sorted into quick wins, keywords worth fighting for, easy pickings and low priority. Press a zone to show only its keywords in the table.",
      },
      {
        kind: "new",
        title: "Insights and totals on the keywords table",
        text: "Each keyword can carry up to two short verdicts, such as Dropping, Page 1 close, Beatable or Not in listing, and the last row of the table adds up the keywords you are looking at: how many rank, their average position and their average popularity and difficulty.",
      },
      {
        kind: "new",
        title: "See which words your listing holds",
        text: "Inside each keyword on the keywords table, the words your title, subtitle or saved keyword field already hold are highlighted, each place in its own colour, and on Google Play the title and short description. Turn the highlights off under Columns.",
      },
      {
        kind: "new",
        title: "Chart the keywords you pick",
        text: "Tick keywords on the keywords table and press Show dynamics to see their positions as one chart above the list. The charted rows are highlighted, the chart follows the market you switch to, and a link with an open chart reopens it for whoever you send it to.",
      },
      {
        kind: "new",
        title: "Inspect any keyword",
        text: "Keyword inspector in the sidebar reads any keyword in any country straight from the store, without tracking it: the top 50 apps, the autocomplete, popularity, difficulty and opportunity, and how strong the top ten are. Every inspection is kept, so the next one of the same keyword shows what changed since.",
      },
      {
        kind: "improved",
        title: "Where a dropped keyword last ranked",
        text: "A keyword that falls out of the search results now shows the position it last held beside its own, as long as it ranked within its last 60 checks, and pointing at it tells you the day it ranked there.",
      },
      {
        kind: "improved",
        title: "Rankings and movers by market",
        text: "The rankings report and its movers table follow the market pills at the top of the page, so All markets watches every storefront and one pill watches just that one.",
      },
      {
        kind: "new",
        title: "Brand and generic keywords",
        text: "Each keyword is marked as your own brand, a competitor's brand or a generic search. A B or CB badge sits after the keyword, a Type filter keeps one kind, the export carries the type, and the menu of a keyword lets you set it yourself when it reads wrong.",
      },
      {
        kind: "new",
        title: "Discovered keywords",
        text: "A Discovered tab beside your tracked keywords lists the searches your app already ranks for, or could rank for, that you do not track yet, with their popularity, difficulty and opportunity. Track one, the ones you tick or every ranked one at once, dismiss the ones you do not want, or switch on Auto-track ranked. The list is checked again every week.",
      },
      {
        kind: "improved",
        title: "Search keywords with or without accents",
        text: "The search box of the keywords table ignores accents, so cafe finds café and uber finds über.",
      },
      {
        kind: "new",
        title: "Keyword gaps, threats and where you lead",
        text: "A Gap analysis section on the competitors page lists the keywords a competitor ranks for and you do not, the gaps you can win now, the competitors closing in on you and the keywords where you lead. The overview sums them up in one line under the visibility chart.",
      },
      {
        kind: "new",
        title: "Share of voice",
        text: "The visibility card shows what part of the visibility you and your tracked competitors hold together is yours, with and without brand keywords, and the visibility chart switches between visibility and share of voice.",
      },
      {
        kind: "new",
        title: "Alerts page",
        text: "An Alerts item in the sidebar lists what the daily run noticed in the last 30 days, such as rank moves, rating drops and listing changes, even if you never set up an alert. Filter it by app or by kind, search it, and a dot on the sidebar item tells you something arrived since your last visit.",
      },
      {
        kind: "new",
        title: "Essential alerts from the first day",
        text: "When your AsoBeast can send email, the owner of a new workspace gets an email alert for the changes that matter most once its first app is checked. Every email alert and webhook lists its rules with a switch for each and can set its own rank drop threshold, and the daily report starts with the biggest moves.",
      },
      {
        kind: "new",
        title: "Rating drop and review spike alerts",
        text: "Get told when the rating of your app falls by as much as you choose, and when far more reviews than usual arrive on one day.",
      },
      {
        kind: "new",
        title: "Alerts when an app leaves the store",
        text: "Get told when the store stops listing your app or a competitor in its home country or in one of the other countries you track.",
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
