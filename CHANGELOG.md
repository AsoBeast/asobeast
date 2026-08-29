# Changelog

All notable changes to asobeast are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.2.0](https://github.com/AsoBeast/asobeast/compare/v1.1.0...v1.2.0) (2026-08-29)


### Features

* **api:** alert and meter a broken store parser ([8cd3008](https://github.com/AsoBeast/asobeast/commit/8cd30088e8befd5b824b543119a34874046e416a))
* **api:** report errors through the sentry sdk ([17ee38c](https://github.com/AsoBeast/asobeast/commit/17ee38cb4080c2f02bf701479a4f83f38ed9c988))
* **apps:** generate the action queue when an app is imported ([ffb134d](https://github.com/AsoBeast/asobeast/commit/ffb134d58209b0b5e97c75b8046d9441eef7c49f))
* **apps:** schedule the first rank pass at import ([a0fffa4](https://github.com/AsoBeast/asobeast/commit/a0fffa46905d70c76150f4b9881ec20650453ef1))
* **apps:** schedule the first rank pass at import ([c8a3ce0](https://github.com/AsoBeast/asobeast/commit/c8a3ce030474e0bd419a052a94af6e37c23adad4))
* **jobs:** merge the published store status into store health ([0685245](https://github.com/AsoBeast/asobeast/commit/068524539908038c46ce66bffdf25c820c1f29fc))
* **jobs:** report exhausted queue failures ([f987df0](https://github.com/AsoBeast/asobeast/commit/f987df0e2ef9844a115bc3310b78d4b269f95960))
* **jobs:** report first run readiness for one app ([4096de0](https://github.com/AsoBeast/asobeast/commit/4096de0807b59ad3d8bdd4afaf80d70e91c6f4f5))
* **jobs:** report whether each store still parses ([eec6967](https://github.com/AsoBeast/asobeast/commit/eec696765d3cc53dbd9e7d9fb857832ced8916d9))
* **jobs:** resolve the next firing of a weekly cron ([50c2081](https://github.com/AsoBeast/asobeast/commit/50c208176eb7a23a5069936ea741998e2f8f7c66))
* **providers:** classify a canary failure as broken, unreachable or missing ([2bb0e5f](https://github.com/AsoBeast/asobeast/commit/2bb0e5fbabe3b55e9150edac897004c75db02a0f))
* **providers:** make a broken store parser a detected product state ([ca81ab8](https://github.com/AsoBeast/asobeast/commit/ca81ab8c8c5e2bedae46035ee906fa8f588ffb45))
* **providers:** parse a published store status document ([27f6683](https://github.com/AsoBeast/asobeast/commit/27f668383a67393f551e72afb4676421246ae258))
* **providers:** poll a published store status when one is configured ([832dceb](https://github.com/AsoBeast/asobeast/commit/832dcebe4d979942458342b152ffcf0b7fcc30c2))
* **providers:** probe each store on a schedule and record the verdict ([a4396a8](https://github.com/AsoBeast/asobeast/commit/a4396a8700fdeb8d5475b80010d71b1fd8fe9990))
* report hosted errors to sentry from the api and the web app ([654ad7b](https://github.com/AsoBeast/asobeast/commit/654ad7baa55d83244d2e572f30c3f38f19f9d314))
* **shared:** add the first run status contract ([0f7bd97](https://github.com/AsoBeast/asobeast/commit/0f7bd977e80c4825475249db4489951af91e495d))
* **shared:** add the store health contract ([09da195](https://github.com/AsoBeast/asobeast/commit/09da195d41045f4d7128f06b388ade448066dbfc))
* **web:** choose one system notice from run and store health ([9cd4e7d](https://github.com/AsoBeast/asobeast/commit/9cd4e7d754ed5160ace128f4304b2968af1dfbe1))
* **web:** map the first run status to timeline rows ([c9b7deb](https://github.com/AsoBeast/asobeast/commit/c9b7deb9676fbca2bcd56ac0990d987ff562a3a2))
* **web:** read the first run status for an app ([73a7cf4](https://github.com/AsoBeast/asobeast/commit/73a7cf4eb87e623a1854043d5acdc6ee95a8f592))
* **web:** report browser and server errors to sentry ([4bcf3de](https://github.com/AsoBeast/asobeast/commit/4bcf3de6e00b06dc5223693804a94bf0019b56be))
* **web:** show a store parser break above everything ([e49370f](https://github.com/AsoBeast/asobeast/commit/e49370f136ba00aaf65bcd9d3ae8de7137c4b9d8))
* **web:** show what a newly imported app is still waiting for ([53c72e6](https://github.com/AsoBeast/asobeast/commit/53c72e6f9332b1e9e481625c19fd4e31ecece476))


### Bug Fixes

* **api:** name the store a request asked for that this version cannot serve ([43959ff](https://github.com/AsoBeast/asobeast/commit/43959ff3268238f23e3584940e4fd816cbc8fb61))
* **api:** stop the sdk reporting every failed job attempt ([6e6a3b6](https://github.com/AsoBeast/asobeast/commit/6e6a3b62f99f6da4d3949fe71d7df4d7e07d9cc7))
* **apps:** keep an import when its first pass cannot be scheduled ([a26aeeb](https://github.com/AsoBeast/asobeast/commit/a26aeeb4cdeb91b818799c9f15d3e5e3e55d3f6a))
* **apps:** name the app in the first run check identifier ([95693a9](https://github.com/AsoBeast/asobeast/commit/95693a997d18f023a8b5d8d1fea862c6f421cd8a))
* **db:** untrack the keywords a competitor snapshot auto tracked ([42fabc9](https://github.com/AsoBeast/asobeast/commit/42fabc92f8dc8a53d87c3bf175ad835a1030d939))
* distinguish unchecked keywords, bound keyword writes, answer 404 for a missing app ([6dcb210](https://github.com/AsoBeast/asobeast/commit/6dcb210175c0a03b0a9efcea7859fd92a16cb682))
* **docker:** load the web env file so the browser can report errors ([d53c2c7](https://github.com/AsoBeast/asobeast/commit/d53c2c73fabf2102fc3ef2e54330eb4fa5e927ba))
* **jobs:** close the first run report once its window has passed ([d3d4034](https://github.com/AsoBeast/asobeast/commit/d3d40342debb8e562eaf9a5504b672563e886743))
* **jobs:** keep egress failure text off the store health route ([37e49c2](https://github.com/AsoBeast/asobeast/commit/37e49c27eae8f1a0a4e5f836415c07eee9dee305))
* **jobs:** stop expecting a review backfill that has had its window ([fcbffa1](https://github.com/AsoBeast/asobeast/commit/fcbffa193c2583f6377b1ca3fe13bf5bf9fb1e05))
* **keywords:** cap the keywords one bulk add request may carry ([f05e97b](https://github.com/AsoBeast/asobeast/commit/f05e97b20f2edaa619d442d74e0e9fbe9967ebb7))
* **keywords:** hold the keyword field to the same caps and quota as a bulk add ([47fe18f](https://github.com/AsoBeast/asobeast/commit/47fe18fd535df25cff2b03889d38a389cc3333e4))
* **keywords:** refuse a keyword phrase no store search box would accept ([417bd3b](https://github.com/AsoBeast/asobeast/commit/417bd3b47ce6c80ba4ee8f01ad8e6f1ec6b78325))
* **keywords:** stop auto tracking keywords for a competitor app ([8dd9c4d](https://github.com/AsoBeast/asobeast/commit/8dd9c4deb46954871f137ac07c99a26d8af5ff25))
* **providers:** answer 404 for an app the store does not have ([2e69cde](https://github.com/AsoBeast/asobeast/commit/2e69cdeed437d5bd08eae781432492ac86e2f679))
* **providers:** keep a missing app out of endpoint health ([5b2cef2](https://github.com/AsoBeast/asobeast/commit/5b2cef28fa6af73c648f705268e2669a4ffac3ed))
* **providers:** keep retrying a missing app, which can be a soft block ([ec22261](https://github.com/AsoBeast/asobeast/commit/ec22261805afa99425040243b3ef67059369c2d0))
* **providers:** reject a published timestamp with no utc offset ([9c1fd31](https://github.com/AsoBeast/asobeast/commit/9c1fd3169002f3f6fd05eba0b93f91517ab7e937))
* **providers:** release the status response body on every early return ([a7ba9ec](https://github.com/AsoBeast/asobeast/commit/a7ba9ec901ff9389f8ba8de56ebd936960c95007))
* **providers:** report an unreadable status body for what it was ([ba00a78](https://github.com/AsoBeast/asobeast/commit/ba00a789825211660889a06085d2e96854d3e025))
* **providers:** require every asserted parser field to be a string ([5b5fc46](https://github.com/AsoBeast/asobeast/commit/5b5fc46a1da0c5224980da31a3e3fc9729fe8a95))
* **providers:** take each store's own signal for a missing app ([1fcc15b](https://github.com/AsoBeast/asobeast/commit/1fcc15b0d1f65e0158d95aa53a484603e2729771))
* **providers:** treat every egress transport failure as unreachable ([328c45b](https://github.com/AsoBeast/asobeast/commit/328c45bb60ea17bef995bc4d520cf9020acde6eb))
* **repo:** bound the nanoid and esbuild overrides to tested majors ([b081e69](https://github.com/AsoBeast/asobeast/commit/b081e696c6198e2b7a1f269173be7013153a3fb0))
* **repo:** bump the captured openapi version with the release ([efe1348](https://github.com/AsoBeast/asobeast/commit/efe13485b6bf49d7045ac1cf6483177ac0698346))
* **repo:** keep the captured openapi version in step with the release ([e8f3d04](https://github.com/AsoBeast/asobeast/commit/e8f3d048489e3887777498dc8c6ea902ca060269))
* **web:** initialize reporting before capturing a browser error ([0f1e284](https://github.com/AsoBeast/asobeast/commit/0f1e284d516f6e64ed50d4f1e90aab613b2cdc13))
* **web:** keep sentry out of the first load and mask the nextjs path ([09adb42](https://github.com/AsoBeast/asobeast/commit/09adb42bf4c6ad429e1852f32f61eedfd7d2c3be))
* **web:** leave a day a keyword was not checked blank on the rankings chart ([26960c9](https://github.com/AsoBeast/asobeast/commit/26960c91013ad06b4c017dfbc7a58688ffc6f812))
* **web:** name the app's own store in the suggestions hint ([64dc492](https://github.com/AsoBeast/asobeast/commit/64dc492aaedac1bb02ff88366c23fc0d83fc0dd8))
* **web:** offer a wider rankings window only when history exists outside it ([22fe80b](https://github.com/AsoBeast/asobeast/commit/22fe80b62bed6f2ea1400bb9bdc0603bce30d54b))
* **web:** take the retry prop next actually passes to an error boundary ([fbe854e](https://github.com/AsoBeast/asobeast/commit/fbe854e40741d2c0a1dd34261b6283339b49fb1c))
* **web:** take the retry prop next actually passes to an error boundary ([7c415fe](https://github.com/AsoBeast/asobeast/commit/7c415fe802ccbc328f8758e382aa995b3aa3f8c6))
* **web:** tell a never checked keyword apart from one beyond depth ([b704b7c](https://github.com/AsoBeast/asobeast/commit/b704b7c85b82fcdf8e3a229385a71c9b2db4ecc2))


### Performance

* **web:** stop polling first run status once only history is left ([df62404](https://github.com/AsoBeast/asobeast/commit/df6240495e2b75951c90f98417b410f72e8153d2))


### Refactoring

* **api:** narrow the queue failure reporter to what it uses ([3bc2730](https://github.com/AsoBeast/asobeast/commit/3bc27308034ef0739e901ac661129ab44afdb636))
* **jobs:** type the store health base without an assertion ([27f20d6](https://github.com/AsoBeast/asobeast/commit/27f20d63b46920daf2541cfe69028ca1381a0371))
* **keywords:** name the selection helper instead of commenting it ([6840b23](https://github.com/AsoBeast/asobeast/commit/6840b23b19d5b6d2786b809361bf95db5dd213ee))
* **providers:** own the parser shape assertions in the source tree ([ad1d9c6](https://github.com/AsoBeast/asobeast/commit/ad1d9c6ae44d267211fa851a8ca571230305328a))
* **repo:** let the sdk name the transaction and skip duplicate reports ([7705a9b](https://github.com/AsoBeast/asobeast/commit/7705a9b536501a705eb24a3bbe6404984d84b3fb))
* **shared:** own the tracked keyword limits both apps enforce ([736b6c3](https://github.com/AsoBeast/asobeast/commit/736b6c3c7ec39fc159fd4fe213b372f0cd2d5453))
* **web:** read the store health call without a type assertion ([0e68964](https://github.com/AsoBeast/asobeast/commit/0e68964b461536d14523aa6eb57bdd695e386052))
* **web:** type the health route by the contract its client reads ([0897332](https://github.com/AsoBeast/asobeast/commit/089733209e23271112dbca555790114edd549109))


### Documentation

* **api:** scope the rate limit header promise to a metered instance ([eaede1e](https://github.com/AsoBeast/asobeast/commit/eaede1e44c9a2a760902cd6622ea3355553a94de))
* **api:** state the bulk add and keyword length ceilings ([2406a4f](https://github.com/AsoBeast/asobeast/commit/2406a4fa2027d9498a9f67003e1f6cb8fb4f6b3f))
* **api:** state the keyword field ceiling alongside the bulk add ones ([919eba1](https://github.com/AsoBeast/asobeast/commit/919eba1a8d9c9b11c3387d3720e38d1c68727558))
* **docs:** correct what an import deduplicates against ([2880548](https://github.com/AsoBeast/asobeast/commit/28805487562678797b4248905ac720571d585d7e))
* **docs:** describe the first run panel ([6917e57](https://github.com/AsoBeast/asobeast/commit/6917e5707fadd9e90f77bdfd36ce09a5c42b63f4))
* **docs:** describe the store breakage banner ([2b4061e](https://github.com/AsoBeast/asobeast/commit/2b4061eccc8f87582f1903f2958c2478daf3e46c))
* **docs:** describe what an import schedules ([47e3946](https://github.com/AsoBeast/asobeast/commit/47e3946c90e06657452d0f83ad816a978a77e421))
* **docs:** document the store status signal as an opt-in outbound call ([570bc30](https://github.com/AsoBeast/asobeast/commit/570bc30fa012081cfcb7cd4e844be45a5d3c0c6f))
* **docs:** put the canary verdict at the top of parser triage ([3c9d3a7](https://github.com/AsoBeast/asobeast/commit/3c9d3a7b141c9bb59d642805893f26ff0b551e3a))
* **docs:** say a status url redirect is not followed ([4b6a1ce](https://github.com/AsoBeast/asobeast/commit/4b6a1ce211badcdc6a04e6b19cdeb11d84964702))
* **repo:** record that the dependency update closes both advisories ([2463894](https://github.com/AsoBeast/asobeast/commit/2463894dc8a931ddea65cfbacc5dec2485033e69))
* **repo:** scope the release version check to what it reads ([9e2e1de](https://github.com/AsoBeast/asobeast/commit/9e2e1de046b8159e5c59dfa3ada990d77144d9f7))
* **repo:** state the web reporting gate as it actually is ([9b5d225](https://github.com/AsoBeast/asobeast/commit/9b5d2253571d8a9bae5c1317775dd0d3b7fa6f14))


### Build and Deployment

* **repo:** add the sentry sdks to the api and the web app ([033b966](https://github.com/AsoBeast/asobeast/commit/033b96682fc07473948ef29bb1da357f911c2741))
* **repo:** keep every pnpm override in one file so the floors apply ([46fa748](https://github.com/AsoBeast/asobeast/commit/46fa7482c331bc13d213524da10c2324626c2826))

## [1.1.0](https://github.com/AsoBeast/asobeast/compare/v1.0.0...v1.1.0) (2026-08-26)


### Features

* **api:** serve the stored App Store keyword field ([babe18d](https://github.com/AsoBeast/asobeast/commit/babe18d347b1530f3bdc8100cd5e8fc36bf2c38a))
* **competitors:** name the store on the discovery panel ([923faa1](https://github.com/AsoBeast/asobeast/commit/923faa129eef7a2cab959ee02f4e89a5090f2be4))


### Bug Fixes

* **alerts:** keep a pressed toggle still under the pointer ([9948994](https://github.com/AsoBeast/asobeast/commit/994899424128cbaa33b687b19a1251dddad3053d))
* **alerts:** keep a pressed toggle still under the pointer ([ac2185f](https://github.com/AsoBeast/asobeast/commit/ac2185f5c624ca8e8172538c908ee2db553c6efa))
* **api:** forgive an empty review feed for an app with no recent reviews ([0f550fd](https://github.com/AsoBeast/asobeast/commit/0f550fde48fa3740ebeab72c9dfdddc10c9d5ce1))
* **auth:** give the sign in and create account pages a page heading ([e299cac](https://github.com/AsoBeast/asobeast/commit/e299cac6a0668e106ef5a1878fd56649bf0551dc))
* **competitors:** match the add competitor example to the app store in view ([7f0cc0e](https://github.com/AsoBeast/asobeast/commit/7f0cc0e6c41ee30cfab68610204a2d2b2503b733))
* **competitors:** track a discovered app on the store it came from ([c6b9470](https://github.com/AsoBeast/asobeast/commit/c6b9470176db57dacb9c29f9c13e261bfc995628))
* **competitors:** track a discovered app on the store it came from ([d08f940](https://github.com/AsoBeast/asobeast/commit/d08f9406044e9fd5f6b23b46cabdff8a7833cffb))
* forgive quiet review feeds, give the auth pages a heading, hide play subtitle coverage ([f179c81](https://github.com/AsoBeast/asobeast/commit/f179c814ac9e0103dab3f599c5883e79abd0a232))
* **jobs:** stop retrying a plausibility rejection ([56e954f](https://github.com/AsoBeast/asobeast/commit/56e954fa3e7216b922c6a0211d144ef78cfb5628))
* **keywords:** auto track a snapshot without racing a concurrent sync ([cfa0853](https://github.com/AsoBeast/asobeast/commit/cfa085307f93634433a3275555c2425f62a922df))
* **keywords:** write a keyword and its tracking without racing another request ([0b9f639](https://github.com/AsoBeast/asobeast/commit/0b9f639ee123e00e621fe47e9b0946a77c25f1db))
* **keywords:** write a keyword and its tracking without racing another request ([5089d15](https://github.com/AsoBeast/asobeast/commit/5089d1575feb0945c4198ad9653f5a487ef91987))
* **shared:** raise the per minute request budgets above the dashboard cost ([45ed8a1](https://github.com/AsoBeast/asobeast/commit/45ed8a1e7046d31676eaa65d6d230fb6f4328543))
* **web:** blame the plan budget only when the plan refused the request ([c3b0dfc](https://github.com/AsoBeast/asobeast/commit/c3b0dfcf54440bea500228d098cb9cb8c00dadba))
* **web:** hide subtitle coverage for google play apps ([d98b328](https://github.com/AsoBeast/asobeast/commit/d98b3283f6b749d8b3a16d339d1ee236b366c5da))
* **web:** keep a server render from retrying a failed query ([cc0c2f1](https://github.com/AsoBeast/asobeast/commit/cc0c2f1423dac1f304fb016d7e059a55c9d5416b))
* **web:** let an emptied keyword field be saved ([69e1940](https://github.com/AsoBeast/asobeast/commit/69e194021b63486a0c2cc8353d51770464afb441))
* **web:** restore the App Store keyword field after a reload ([eaea8bd](https://github.com/AsoBeast/asobeast/commit/eaea8bd6f5fe3c395b97bcb774cdc36178d6f3b7))
* **web:** restore the keyword field editor from the stored value ([260728b](https://github.com/AsoBeast/asobeast/commit/260728bddf67a66c0417bd581ac7c9a4b02e72c1))
* **web:** show the plan rate limit reason instead of the generic error ([efd6133](https://github.com/AsoBeast/asobeast/commit/efd613368c150695ec956790a26347b353ad343f))
* **web:** stop retrying a refused request before Retry-After elapses ([aa3e5b9](https://github.com/AsoBeast/asobeast/commit/aa3e5b90578282bd26e63a6a59e6f6ccfd774b98))
* **web:** stop the dashboard exhausting the trial read budget ([2353723](https://github.com/AsoBeast/asobeast/commit/2353723ce9900c18ccab836c9e89df2fdee8d6c0))


### Performance

* **web:** prefetch app detail on intent instead of on sight ([2808efa](https://github.com/AsoBeast/asobeast/commit/2808efae7b10be1da3841b60e985ac08c6d550cb))


### Refactoring

* **alerts:** expose the event toggles as a labelled group ([7547527](https://github.com/AsoBeast/asobeast/commit/754752747b0ab08c5b130a6fe02e51c4e002a3d9))
* **api:** move the implausible result rule beside the store providers ([f9003e9](https://github.com/AsoBeast/asobeast/commit/f9003e9207fd751cdf0bc5f276285408b373fcf5))
* **api:** name the plausibility input for both of its callers ([4fafe31](https://github.com/AsoBeast/asobeast/commit/4fafe316a842914f6311eedf8b48968a26adfcf9))


### Documentation

* **docs:** document the keyword field read endpoint ([c1c39ce](https://github.com/AsoBeast/asobeast/commit/c1c39ce338c488afb10867d178f1b9e8e948cf4c))
* **docs:** restate the published rate limits ([46e3a8c](https://github.com/AsoBeast/asobeast/commit/46e3a8c85a916a54527d68bd99d1af235ab7fdb3))

## 1.0.0 (2026-08-24)

The first public release.

### Highlights

- **Tenancy is enforced by the database.** Every tenant-owned table carries a `tenant_isolation` row level security policy reading `app.workspace_id`, and every Prisma operation runs in a transaction that enters the workspace and drops to the non-owner `asobeast_app` role. A query with no workspace in scope returns nothing rather than everything. Work that genuinely spans tenants goes through a single `CrossTenantAccess` escape hatch that demands a written justification, and a dedicated isolation suite (`pnpm --filter api test:isolation`) proves it on every pull request.
- **Plans, quotas and billing.** Plans and their limits are typed data in `@asobeast/shared`; entitlement lives on `Workspace` rather than `User`, because a workspace has one plan whatever the size of the team. Stripe delivers checkout, the customer portal, idempotent subscription webhooks, daily reconciliation, period-end downgrades and cancellations, card-free trials and payment-failure notices. `BILLING_ENABLED=false` keeps a self-hosted install single-workspace and entirely free of it.
- **A proxy pool for store requests.** `PROXY_PROVIDER=webshare` reconciles a pool against the provider, spreads store requests across endpoints under a per-endpoint budget, classifies failures, tracks endpoint health and exposes it to operators. A residential fallback is available behind a hard monthly cost ceiling that refuses every request at `0`. `PROXY_PROVIDER=none` keeps every request on the host address, exactly as before.
- **The daily pipeline fans out per workspace.** Runs interleave across workspaces, degrade in a defined order under capacity pressure, and report per-workspace budget and projected completion. A keyword two workspaces track is still one search.
- **Rate limits everywhere.** Every endpoint is classified by cost and limited per workspace from Redis-backed counters, answering with standard rate limit headers and typed limit errors. Sustained abuse is flagged, and an operator can suspend a workspace by hand.
- **A remote MCP endpoint.** `POST /mcp` serves the same read-only tool catalog as the stdio binary from one shared definition in `@asobeast/mcp-tools`, authenticated by an `asob_` token, entitlement-checked and rate limited per workspace. Both surfaces now run `@modelcontextprotocol/server@2.0.0` and serve protocol `2026-07-28` alongside the 2025 revisions.
- **Operations you can run.** Structured logging with tenant and correlation context, per-workspace operational metrics, capacity and anomaly alerting, optional cloud-only error tracking with scrubbing, owner-only support tooling, and in-app delay notices for affected customers.
- **Account and data rights.** Password recovery from the login card with single-use tokens that reset every other session, workspace member invitations, personal API tokens with expiry and a read-only scope, and complete workspace export and deletion.
- **Packaging.** `docker-compose.pull.yml` runs the published GHCR images without a clone or a build, completing the pinned-image path promised for this release.

### Install notes

- **Migrations are additive and forward only.** The API applies them on boot. Take a database backup before any upgrade regardless; see [Backups](docs/operations/backups.mdx) and [Restore](docs/operations/restore.mdx).

- **Row level security changes who may run migrations.** Migrations and the seed must run as a role that bypasses the policies, which is the superuser the images already use. A deployment that runs migrations as a restricted role needs to change that before upgrading.
- **A self-hosted install needs no configuration change.** `BILLING_ENABLED` defaults to `false`, `PROXY_PROVIDER` defaults to `none`, and every new variable has a working default. Nothing about billing, proxies, capacity gating or error tracking activates until it is switched on deliberately.
- **`WEBHOOK_ALLOW_PRIVATE_TARGETS` defaults to `false`.** Alert webhooks are now refused against loopback, private, carrier-grade NAT, link-local and cloud metadata targets, at registration and again when the connection is made. If you deliver alerts to your own LAN from a self-hosted instance, set it to `true`. It refuses to boot alongside `BILLING_ENABLED=true`.

### Compatibility promise

From this release, the HTTP contract, the `@asobeast/shared` contract types and the MCP tool surface stay compatible throughout the `1.x` line. Breaking any of them requires `2.0.0`. Environment variables, the database schema and internal modules are outside that promise, and every schema change ships as a forward Prisma migration.
