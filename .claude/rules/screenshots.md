---
paths:
  - "apps/api/src/screenshots/**"
  - "apps/api/src/apps/listing-capture.service.ts"
  - "apps/web/src/components/screenshots/**"
  - "apps/web/src/lib/screenshot-captions.ts"
---

# Screenshot caption rules

## Domain rule 16: Screenshot captions are read on the host, per snapshot, and are a weak surface

Recording:

- Every snapshot records its ordered screenshots in `SnapshotScreenshot` (RLS, cascades with the snapshot) inside the transaction that creates it, for both stores and every listing, market listings included; the read is queued right after that transaction commits.
- The language set comes from the snapshot's own storefront (`listingMarket(app.country, snapshot.country)`) or its localization (`ocrLanguagesFor`), never `app.country` alone.

Reading (App Store only):

- `ScreenshotReader` reads in the `screenshots` queue at concurrency 1, inside the job's workspace scope. It downloads through `ScreenshotImageSource`, the one module that fetches a store image: `1080x0w.jpg` renditions of Apple's image hosts for OCR, and through `readListed` an App Store or Google Play image exactly as listed for the creative analysis (domain rule 14). Never through the proxy pool or a store request budget. `IconImageSource` reads the `512x0w` renditions of two icon addresses through the same source, bounded by the store deadline inside a request.
- It prepares the image with `sharp`, reads it with the `OcrEngine`, keeps the large confident lines (`selectCaption`) and caches the result in `ScreenshotText`, shared across workspaces with no policy (public pixels, like `Keyword`), keyed by asset key (the address without its size segment) and recipe (`OCR_RECIPE_VERSION`, currently `ocr2:`, plus the languages).
- The engine always gets a local `langPath` and `cacheMethod: 'none'`; a language pack is never fetched at runtime. tesseract.js runs in a worker thread of `TesseractOcrEngine` (`screenshots/ocr-thread.ts`), never the main thread, because it throws its own worker's failures from an event listener; a damaged pack ends the thread and fails the read, the job retries, the API keeps serving. The thread file imports only packages and types (Jest runs it through Node's type stripping).
- Reading never calls OpenAI or `AiGateway`. Google Play screenshots are recorded and diffed, never read.

Using captions:

- Captions are not an indexed field: never in `uncovered`, the keyword field suggestion or an Action Center rule (`REGRESSION_INDEXED_FIELDS` is explicit), and in the audit only through `screenshots-caption-keywords` when no AI analysis exists.
- `ChangeField`: `screenshots` keeps its numeric before and after and fires exactly when the count changes; `screenshotImages` fires for a replacement or reorder at the same count; `screenshotCaptions` is recorded by `CaptionChangeRecorder` once per snapshot, only when both snapshots are fully read with the same recipe. An optional `ChangeEvent.detail` carries the structure; alerts receive only the field and the two readable values.
- Every comparison stays inside one listing (same app and stored country, `listingIn`, `eventsIn`); market listing events carry their market and dispatch nothing. Coverage reads the captions of the listing that judged each row, `GET /apps/:id/screenshots?country=` reads a market listing, and the audit check reads home only.
- `SCREENSHOT_OCR=false` keeps recording and image diffing and stops every screenshot download and read. A changed icon address is still checked by downloading its two `512x0w` renditions, which keeps a CDN rotation out of the timeline; a Play icon has no Apple rendition, so its changes always record.
