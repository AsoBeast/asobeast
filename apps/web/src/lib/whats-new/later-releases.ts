import type { Release } from "./release-notes";

export const LATER_RELEASES: readonly Release[] = [
  {
    version: "2.1.0",
    date: "2026-11-24",
    title: "Help me write it",
    summary:
      "The metadata page helps you write the next version of your listing before it ships.",
    changes: [
      {
        kind: "new",
        title: "Draft your next listing",
        text: "The metadata page has a Draft mode: write the next title, subtitle, keyword field and description beside the live ones and see, while you type, which tracked keywords the draft would newly cover, which ones it would lose, and which words are wasted. The draft is kept in your browser, and while you type its text goes to your AsoBeast server to work out that coverage, never to the stores. Copy it out for App Store Connect or Play Console, and save the keyword field through its usual editor.",
      },
      {
        kind: "new",
        title: "See your listing the way the store shows it",
        text: "The overview and the draft show your listing as a search result and as a product page, light or dark, on a smaller and a larger iPhone. When a title or subtitle is too long, the preview estimates where the store cuts it and says after which words, and under each draft field you see the words search reads.",
      },
      {
        kind: "fixed",
        title: "A search that lists no apps says so",
        text: "When a store lists no apps at all for a keyword you track, its position now reads No apps instead of more than 200: in the keywords table, on the rankings page with its chart and movers, in the position history, the search results sheet, the discovery list and the keyword breakdown. Pointing at it explains that the store lists no apps for this search. A rank alert and the weekly digest say the same when this happens to a keyword that used to rank. Checks from before this update keep the number they were stored with.",
      },
      {
        kind: "fixed",
        title: "A scheduled plan change shows in Settings",
        text: "When you move to a smaller plan in the billing portal and the change waits for the end of the period, the Plan section in Settings now names the plan you switch to and the day it starts, instead of saying the current plan renews.",
      },
      {
        kind: "fixed",
        title: "A declined card says so at the top",
        text: "When the card on a free trial is declined at the end of the trial, the bar at the top of every page now says the card was declined and links to billing in Settings, where you update the card in the billing portal, instead of asking you to choose a plan again.",
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-11-10",
    title: "AsoBeast 2",
    summary:
      "Every screen now opens with what moved and what to do next, and the keyword inspector looks up any keyword in any country without tracking it.",
    changes: [
      {
        kind: "new",
        title: "Inspect any keyword",
        text: "Keyword inspector in the sidebar reads any keyword in any country straight from the store, without tracking it: the top 50 apps, the autocomplete, popularity, difficulty and opportunity, and how strong the top ten are. Each keyword you inspect lands on a map beside the others, its store suggestions inspect in one click, and the next inspection of the same keyword shows what changed since.",
      },
      {
        kind: "new",
        title: "A ratings goal",
        text: "Pick the average you want the store to show and the number of days, and the Reviews page says how many five-star ratings it takes to get there and how fast they need to come.",
      },
      {
        kind: "new",
        title: "The audit reads nominations and promotional text",
        text: "When App Store Connect is connected, the featuring readiness panel answers two more rows: whether a featuring nomination is submitted ahead of its publish window, and how many of your localizations carry promotional text. Where the connection cannot read them, has not refreshed them in a few days, or has lost the app, the rows say so instead of guessing.",
      },
      {
        kind: "fixed",
        title: "Play installs finds more search terms",
        text: "Google writes most search terms under explore traffic rather than search, and the column used to read only search, so months could look empty that never were. It now reads both, while the placeholders Google writes when it names no term stay out of the column.",
      },
      {
        kind: "new",
        title: "In-app events, featuring and badges in the feed",
        text: "The changes feed now also notices what the store itself adds around an app: when in-app events appear or disappear, when the app enters or leaves a featured story and when an Editors' Choice badge is gained or lost, for your apps and your competitors alike. Each row carries what changed with it, so an event keeps its name, kind and dates and a story keeps its title, even when the store names nothing.",
      },
      {
        kind: "improved",
        title: "Fields the store does not search say so",
        text: "On the metadata page, a field the App Store does not search is now labelled next to its name, so you know not to spend keywords there.",
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
        title: "See which app moved on the dashboard",
        text: "The dashboard chart is one line for every app, so a dip never said which app caused it. A list beside the chart now breaks the figure down by app, largest change first, and selecting an app draws the chart for that app alone. Point at a day to read the apps that moved most on it and the listing changes you made that day, which are also marked on the chart. The sentence under the title starts with what the last run changed, keyword movers open on the same and name the app of each keyword, the top 10 chart splits your keywords into rank bands, and the app table now follows the range you pick instead of always showing seven days.",
      },
      {
        kind: "improved",
        title: "An app overview that leads with what matters",
        text: "The overview of an app now opens with four figures: visibility, share of voice, keywords in the top 10 and the store rating. Select any of them to draw its chart. The visibility chart shows the range before as a second line and marks the days your listing changed, with a link to what each change did. Keyword movers sit right under it with a small line of each keyword's last 30 days, followed by the keywords closest to the top 10, the next things to do and how many tracked keywords each part of your listing covers. The store funnel shows a trend line under each number, category ranks and ratings by market follow as reference, and the app's own icon now sits beside its name on every page.",
      },
      {
        kind: "improved",
        title: "Daily pages that open with what moved",
        text: "Alerts, Rankings, Reviews, Competitors, Top charts and Changes now each open with one sentence about what changed since your last look, and show it the way the dashboard does. Alerts is one list grouped by day with the size of each move beside its sentence. Rankings has a row per keyword under the chart with today's position, the move and the best and average position, plus a By day view. Reviews draws the rating and the ratings gained as charts, lists the average rating per app version and keeps the reviews in one list with a switch for what needs a reply. Competitors ranks you against every competitor by visibility and counts the keywords you lead and trail on. Top charts lists your apps and competitors with their place in every chart and shows how much of each chart moved. Changes marks each listing change on a visibility chart and reads its effect after 7, 14 and 28 days in one table.",
      },
      {
        kind: "improved",
        title: "Work pages that say where to start",
        text: "The Action Center opens with the one action that matters most, its steps and a button to the page where you fix it, and every action in the queue says why it is there in its own numbers. The audit leads with your score, how it moved since last week and what the top fixes are worth. The metadata page counts the work left in one line and shows how many tracked keywords each field carries. Setting up an app keeps its three steps and the button that completes the setup in view while you scroll.",
      },
      {
        kind: "improved",
        title: "Settings, integrations and lookups you can scan",
        text: "Settings and Integrations put each action at the right of its panel and say their facts in plain text: how many stores are connected, how many days of store data each app has and where the daily request budget goes. The keyword inspector shows each score with a line in its grade colour and its value at the previous inspection, and says in one sentence whether a keyword is worth going after. What's New shows one line per change that opens when you press it and folds every release you have read.",
      },
      {
        kind: "improved",
        title: "Simpler sign in and sign up pages",
        text: "Sign in, create account, password recovery and the pages your email links open now share one calm centred layout with larger buttons. Every password field on these pages has a button to show what you typed, and the password rule is one short line that turns into the error when a password is too short. On the hosted service, create account now shows the steps of signing up above the form, so you see what comes next.",
      },
      {
        kind: "improved",
        title: "Larger text, the brand orange back and calmer empty states",
        text: "Text, buttons and the sidebar are a step larger, so a long session is easier on the eyes. Orange marks what you select and what is yours, such as the page you are on, your app in search results and your default language, warnings turn yellow so they never look like the brand, and blue is left to charts. A chart, a list or a page with nothing to show yet says so in one centred sentence without a box around it, and the alerts on the dashboard show the size of each move instead of a word on every line.",
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
        title: "A calmer, sharper look",
        text: "AsoBeast has a new typeface, warmer neutral colours and flatter panels with fine borders. Numbers line up in columns and labels are easier to read.",
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
      {
        kind: "new",
        title: "Featuring readiness on the audit page",
        text: "The audit page for an App Store app now carries a featuring readiness checklist beside the score: whether the store page shows a preview video and lists an in-app event, next to what the audit already measures about ratings, updates, localizations and screenshots. A row the data cannot answer reads Not measured, and the footer shows how many featured stories and whether the Editors' Choice badge is on the page, together with the day that page was read.",
      },
      {
        kind: "new",
        title: "Say why you leave, if you like",
        text: "Deleting a workspace now asks, without insisting, why you are leaving, from a short list. Prefer not to say is the default. Once the workspace is erased, only the answer and a few counts are kept, with nothing that names you or the workspace.",
      },
      {
        kind: "fixed",
        title: "Positions say how far the store looked",
        text: "When your app is not found for a keyword, the position now shows how far that day's check looked, up to 200 apps, such as more than 30 on Google Play, instead of always saying more than 200. Google Play's search usually lists about 30 apps, so the old number promised a deeper look than most checks could make. A search that lists no apps at all still shows more than 200, and checks from before this update keep the number they were stored with.",
      },
      {
        kind: "fixed",
        title: "A full list when you search the App Store",
        text: "Searching the App Store by name when you import an app or add a competitor lists as many apps as you asked for, in close to the order your positions are checked in.",
      },
      {
        kind: "improved",
        title: "Calmer notices, errors and messages",
        text: "The bar that tells you about a trial, a paused plan or a suspended workspace is now one quiet line with its link beside the sentence, and it turns amber when three days of a trial are left. A page that is not found or fails to load says so the same way everywhere, with one button to carry on. A message about something that failed can be closed, and messages no longer cover the setup checklist button.",
      },
      {
        kind: "improved",
        title: "Emails that look like the app",
        text: "Account, billing and alert emails now use the same typeface, colours and shapes as the app, in light and dark. Links are plain underlined text, so the orange button is the one thing that stands out. Nothing an email says has changed.",
      },
      {
        kind: "improved",
        title: "Track several suggestions at once",
        text: "On the keywords page, tick the suggestions you want and track them together with one button, instead of pressing Track on each. Phrases you already track have no tick, and switching the source or the market starts a fresh selection.",
      },
      {
        kind: "fixed",
        title: "Keyword figures that agree after a partial run",
        text: "When a daily run missed some keywords on the first day of the range you look at, the keywords in the top 10 and the visibility change used to count those keywords as not found, while the keyword movers already compared them with the day next to it. On the dashboard and the app overview, the keyword movers, the keywords in the top 10 and the visibility change now compare each keyword with the same earlier check when it has one on that day or the day next to it, so a keyword already in the top 10 is no longer counted as a new entry. While today's run is still checking your keywords, a keyword it has not reached yet now counts with its position of the day before, so the keywords in the top 10 and visibility no longer dip every morning and match the keywords page.",
      },
      {
        kind: "new",
        title: "Send keywords to your keyword field",
        text: "Select keywords on the keywords page of an App Store app and choose Add to keyword field. The metadata page opens on the right language with those keywords added after the ones already in the field, ready to review and save. Keywords already in the field are not added twice, and only what fits in the 100 characters is taken along.",
      },
      {
        kind: "fixed",
        title: "Imports while the server is busy",
        text: "Importing an app, adding a competitor or refreshing a listing on Google Play used to wait 20 seconds and then fail while the daily collection kept the server busy. Part of the server's capacity now stays free for what you are waiting for, so these usually go through at once, and when that part is taken too you are told within a few seconds how long to wait before trying again.",
      },
      {
        kind: "fixed",
        title: "A failed import says why",
        text: "When the App Store or Google Play does not cooperate, an import, a new competitor or a refresh now says what happened: the store took too long, turned the request away, could not be reached or changed its page. If the server itself was too busy to ask the store, the attempt no longer counts toward your daily limit.",
      },
      {
        kind: "improved",
        title: "Your first numbers come sooner",
        text: "After you import an app or track new keywords, their first positions and scores are now collected ahead of the daily collection still in progress, instead of waiting behind it.",
      },
      {
        kind: "improved",
        title: "Imports wait out a busy moment",
        text: "When the server is briefly too busy to reach a store, importing an app or adding a competitor now waits the few seconds it was asked to and tries once more by itself, with a line saying so, instead of asking you to press the button again.",
      },
      {
        kind: "fixed",
        title: "Similar apps in the store's own order",
        text: "Competitor suggestions for an App Store app now come from the store's You Might Also Like section, in the order the store shows it, instead of opening with the developer's other apps. Keyword suggestions from similar apps improve the same way.",
      },
      {
        kind: "improved",
        title: "Thirty days on the keywords trend",
        text: "The trend column of the keywords table can now show the last 30 days instead of the last 7. Open Columns and pick the window; the line, the change beside it and the sort follow, and the choice stays in the page address. A day with no ranked check now leaves a gap in the line instead of a slope, and a row with too few ranked checks says so in words.",
      },
      {
        kind: "fixed",
        title: "Rating chart labels you can read",
        text: "When an app's rating barely moved, the average rating chart could print the same label twice and place its lines between the values they named. Each line now sits on a tenth of a star and says which one, never twice.",
      },
      {
        kind: "fixed",
        title: "No competitor names in your listing advice",
        text: "The stores do not allow other apps' names in your title, subtitle or keyword field, yet a keyword marked as a competitor's brand could still be suggested for them. The Action Center, the audit, the keyword field suggestion, the drafts and the overview now leave such keywords out, while you keep tracking where you rank for them. Mark a keyword generic if it is not really a brand.",
      },
      {
        kind: "fixed",
        title: "Words in different fields count on the App Store",
        text: "The App Store finds a search when all of its words are in the title, subtitle and keyword field of one language of your listing, in any order; words from two languages do not add up. A keyword like that no longer reads Not in listing or counts as not covered; the metadata page marks it Words split, since the whole phrase in one field may still rank higher. Google Play keeps looking for the whole phrase.",
      },
      {
        kind: "fixed",
        title: "Every dashboard app shows its store",
        text: "In the By app list on the dashboard, a long app name could push the store and country out of sight, so the same app on both stores looked like two identical rows. The store and country now always stay visible, and the full name shows when you point at it.",
      },
      {
        kind: "fixed",
        title: "Visibility with one decimal",
        text: "Visibility and its changes now always show one decimal, so a change reads 15.2 to 20.0 rather than 15.2 to 20, and the rating, conversion and audit figures in the Action Center keep one precision on both sides of a change.",
      },
      {
        kind: "fixed",
        title: "Action Center keys and bulk changes",
        text: "Pressing s or Shift D on an action now opens its menu on the snooze options or on Dismiss, as the shortcuts list says. Selecting every action shown and pressing Done, Snooze or Dismiss now changes all of them, however many the queue shows, where more than one hundred used to change nothing.",
      },
      {
        kind: "fixed",
        title: "Whole words in the suggested keyword field",
        text: "The suggested keyword field used to drop the last letter of English words ending in s, so focus became focu and news became new. It now keeps every word as you track it and writes the singular only when you track that singular too, and the keyword field check no longer calls news a plural of new.",
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
        text: "A self-hosted AsoBeast follows as many competitors as you like.",
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
