import type { Release } from "./release-notes";

export const LATER_RELEASES: readonly Release[] = [
  {
    version: "1.17.0",
    date: "2026-11-10",
    title: "Keyword inspector",
    summary:
      "Look up any keyword in any country without tracking it, and see it beside every keyword you looked up before.",
    changes: [
      {
        kind: "new",
        title: "Inspect any keyword",
        text: "Keyword inspector in the sidebar reads any keyword in any country straight from the store, without tracking it: the top 50 apps, the autocomplete, popularity, difficulty and opportunity, and how strong the top ten are. Each keyword you inspect lands on a map beside the others, its store suggestions inspect in one click, and the next inspection of the same keyword shows what changed since.",
      },
      {
        kind: "fixed",
        title: "Play installs finds more search terms",
        text: "Google writes most search terms under explore traffic rather than search, and the column used to read only search, so months could look empty that never were. It now reads both, while the placeholders Google writes when it names no term stay out of the column.",
      },
      {
        kind: "improved",
        title: "An empty month says so",
        text: "When the newest monthly report names no search term on any source, the column now states that fact with the month, instead of leaving a row of unexplained dashes.",
      },
      {
        kind: "improved",
        title: "A dashboard that starts with what moved",
        text: "The dashboard now opens with one sentence about the keywords that climbed and fell over the days you choose, then your visibility across every app as one figure. Pick the last 7, 30 or 90 days beside Import app and the sentence, the changes on the four figures, the keyword movers and the chart follow it, and each figure draws its own chart when you select it. Your keyword movers sit beside the next things to do, your apps are a table with a trend line each (the cards are one click away), and your latest alerts sit beside listing changes, where a run of version updates is folded into one line.",
      },
      {
        kind: "improved",
        title: "An app overview that leads with what matters",
        text: "The overview of an app now opens with four figures: visibility, share of voice, keywords in the top 10 and the store rating. Select any of them to draw its chart. The visibility chart shows the range before as a second line and marks the days your listing changed, with a link to what each change did. Keyword movers sit right under it with a small line of each keyword's last 30 days, followed by the keywords closest to the top 10, the next things to do and how many tracked keywords each part of your listing covers. The store funnel shows a trend line under each number, category ranks and ratings by market follow as reference, and the app's own icon now sits beside its name on every page.",
      },
      {
        kind: "improved",
        title: "Alerts you can read at a glance",
        text: "The alerts page is now one list instead of a card per event. It opens by saying how many events are new since your last visit, groups them by day, and shows the size of each move beside its sentence, such as 8 positions down or 13 up, so the big ones stand out without reading every line. The app, store and country of each event line up in their own column, and on a phone each event takes two short lines.",
      },
      {
        kind: "improved",
        title: "Settings and Integrations you can scan",
        text: "Settings and Integrations now put each action at the right of its panel and say their facts in plain text. Integrations opens by saying how many stores are connected and how many apps report, each store shows whether it is connected and how many days of store data each app has, and the token table shows how much each token is used. Settings lists its sections at the side on a wide screen, draws where the daily request budget goes as one bar, and shows what each alert channel sends in one line with its recent deliveries a click away.",
      },
      {
        kind: "improved",
        title: "Rankings you can read without hovering",
        text: "The rankings page now opens by saying what climbed and fell since yesterday and how many apps entered your top 10. Under the chart, each keyword has a row with its position today, how far it moved over the days you chose, and its best and average position. A new By day view lists the position of every keyword on every day, shaded by how high it ranked. The market is one menu with the number of keywords in each country, new apps in your top 10 are grouped by day, and adding an annotation opens a small form instead of taking up the page.",
      },
      {
        kind: "improved",
        title: "Reviews that start with what needs you",
        text: "The reviews page now opens with one sentence: how many reviews arrived since yesterday, how many wait for a reply and how the rating moved over the week. The rating and the number of ratings each draw their own chart, the average on a scale that shows small moves and the ratings gained day by day. Beside them sit the spread of stars, a new list of the average rating per app version, so a release that upset people stands out, and what people mention as a list you can press to find those reviews. The reviews are one list with a switch for all, needs reply, draft and replied, each review says its reply state in words, and the reply editor opens inside the review you are answering.",
      },
      {
        kind: "improved",
        title: "An audit that leads with the score and the fixes",
        text: "The audit page now opens with one sentence: your score, how it moved since last week and what the top fixes are worth. The score sits in a large ring beside search visibility, conversion and the share of the audit that could be measured, with the score history right under them and a dashed line for the score the plan leads to. The top fixes and a count of the checks that pass sit beside it. The plan is one list with the impact, effort and points of each fix, every factor is a row with a coloured line for its score and its checks one press away, and the comparison with your competitors says how far you are from their median.",
      },
      {
        kind: "new",
        title: "Press a keyword to see everything about it",
        text: "Pressing a keyword in the keywords table opens a sheet beside it: its position and what changed since yesterday, its scores and where each one comes from, the reason behind every insight, the position history with the days your listing changed, the top 10 search results with you and your competitors marked, and where the phrase sits in your listing. The keyword's menu is at the top of the sheet beside arrows that step to the previous and the next keyword, and a copied link opens the same sheet. The line in the Last 7 days column now opens the position history, and every button shows a hand when you point at it.",
      },
      {
        kind: "improved",
        title: "One place to find new keywords",
        text: "The Discovered tab of the keywords page now holds everything that proposes keywords: the discovered list, Suggestions and Keyword combinations. The discovered list reads like the tracked table, with the position in a chip and a meter under each score, and you can sort it by any column, search it and select every row at once. Suggestions sit in columns with the Track button beside each phrase, Keyword combinations says how many phrases you do not track yet, and What search reads can be folded away and stays that way. On the tracked table the bar for selected keywords only offers what applies, the filters you use most come first, and a keywords page without keywords links straight to finding some.",
      },
      {
        kind: "improved",
        title: "A keywords page that gets to the numbers",
        text: "The keywords page now fits its controls on one row: the tracked and discovered lists, a market menu with the keyword count of each market, the table or map switch and Add keywords. One sentence under it says how many keywords moved up and down since yesterday. Every filter sits behind one Filters button, and the table shows more at a glance: the position is a chip that turns green in the top 3, a Change column says how far each keyword moved since yesterday and names the ones that dropped out or entered the results, with one press beside the search to see only what moved, fell or was lost, a line draws the last 7 days beside the weekly change, the icons of the three apps that rank highest sit in their own column and open the search results when pressed, and a footer counts how many keywords moved. For an App Store app the default columns fit a small laptop without scrolling sideways, and each row keeps one menu at its right edge for search results, tags, scoring and pausing. Tags, Source and Volatility are hidden until you turn them on under Columns, and the note about comparing the two stores moved to the info button beside Popularity. Suggestions and Keyword combinations take one line until you open them.",
      },
      {
        kind: "improved",
        title: "An Action Center that says where to start",
        text: "The Action Center now opens with what the day of the last run opened and closed, and a Start here panel with the action that matters most: why it is there, the steps to take and a button to the page where you fix it. The queue is one list instead of a card per action, and every row says why it is there in a line of its own numbers, such as the positions you moved between or the apps that entered above you. Done sits on each row and snooze, dismiss and copy link are in its menu. Every filter is behind one Filters button, progress is drawn as actions opened above and closed below, and Where the work is can be split by app or by type of work.",
      },
      {
        kind: "improved",
        title: "A competitors page that shows who is ahead",
        text: "The competitors page now opens with one sentence: how many competitors you track and the latest change one of them made to its listing. A new panel, How you compare, ranks your app and every competitor by visibility with their ratings, and switches to each app's title and subtitle with their character counts. Under the comparison a totals row counts your keywords in the top 10 and, for each competitor, how many keywords you lead and trail on. Positions use the same marks as the keywords page, numbers line up on the right, a phone shows the competitor's position beside yours, and the keywords of a discovered app open with a tap.",
      },
      {
        kind: "improved",
        title: "A metadata page that shows what to work on",
        text: "The metadata page now opens with one line that counts the work left: fields with issues, keywords your listing does not cover, screenshots with a caption and how much of your keyword fields you use. A new panel beside the fields, Coverage by field, shows how many tracked keywords your title, subtitle and keyword field each carry and lists the keywords missing from the listing. Keyword coverage comes right after the fields, each localization shows how full its keyword field is, and the suggested keyword field says which words it adds and sits beside the fields it fills.",
      },
      {
        kind: "improved",
        title: "Top charts that show where you stand",
        text: "Top charts now opens with one sentence about where your app sits and how many apps climbed, fell and entered. A panel above the charts lists your apps and competitors with their place in the free, paid and grossing charts, even when they sit below the rows shown, with a line of the last 30 days for your own app. Each chart shows at a glance how much of it moved, rows are shorter so more fit on a screen, and the table of a chart has a History view that draws the top ten over the last captured days with your app picked out.",
      },
      {
        kind: "improved",
        title: "A changes page that shows what each edit did",
        text: "The changes page now opens with one sentence about the newest change and the effect of the last one that could be measured. A chart draws your visibility over the days you choose with a marker on each day you changed your listing, and under it a line per app shows when you and each competitor changed text, screenshots or the icon, or shipped a release or a new price; press a mark to jump to that day. The effect of each change reads across 7, 14 and 28 days in one table, with a bar for how many keywords improved and declined. The list of changes is shorter rows under each day, a competitor’s run of version updates folds into one row, and a panel counts what changed, yours beside your competitors, and filters the list when you press a row.",
      },
      {
        kind: "improved",
        title: "A calmer, sharper look",
        text: "AsoBeast has a new typeface, warmer neutral colours and flatter panels with fine borders. Numbers line up in columns and labels are easier to read.",
      },
      {
        kind: "improved",
        title: "Larger text and the brand orange back",
        text: "Text, buttons and the sidebar are a step larger, so a long session is easier on the eyes. Orange now marks what you select and what is yours, such as the page you are on, your app in search results and your default language, and fills checked boxes and progress bars. Warnings turn yellow so they never look like the brand, and blue is left to charts.",
      },
      {
        kind: "improved",
        title: "Calmer empty charts",
        text: "A chart with nothing to draw yet says so in the middle of the chart without a dashed box around it, and so do a page that is not found and the first visit before any app is imported. The run indicator turns grey, and a new entry in search results or a top chart reads New in green.",
      },
      {
        kind: "new",
        title: "Reveal column",
        text: "A Reveal column on the keywords table shows how many letters a shopper types before the store suggests a keyword and where it appears in the suggestions. It is hidden by default and can be turned on from the column menu.",
      },
      {
        kind: "improved",
        title: "The audit now sees preview videos",
        text: "The audit reads the App Store page itself, so the preview video factor is scored for App Store apps instead of being left unmeasured. A listing without a preview sees the gap in its plan. An app without a preview video scores about three to four points lower the next time the audit runs, and a score close to a grade line can drop a grade.",
      },
    ],
  },
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
      {
        kind: "fixed",
        title: "AI analysis of your icon and screenshots",
        text: "The AI analysis no longer fails now and then because the images could not be loaded, and every AI feature has more room to think before it answers.",
      },
      {
        kind: "fixed",
        title: "The plan page on a weak connection",
        text: "When the plan page cannot load your plan or the prices, it now says so and lets you try again, instead of showing an offer or a checkout that may not apply to you.",
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
