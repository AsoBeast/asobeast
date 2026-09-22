# Changelog

All notable changes to asobeast are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.5.0](https://github.com/AsoBeast/asobeast/compare/v1.4.0...v1.5.0) (2026-09-22)


### ⚠ BREAKING CHANGES

* **web:** the keywords CSV export names the score column popularity instead of traffic.

### Features

* **actions:** retune the defend rule for the v2 volume scale ([b2e15cf](https://github.com/AsoBeast/asobeast/commit/b2e15cff30ebaa2dc83a3650135dee81e3d511df))
* **db:** add the search term popularity table ([637fd2f](https://github.com/AsoBeast/asobeast/commit/637fd2f16624a5e2b83afcb93cbd8b4d906388dc))
* **jobs:** rescore keywords once when the formula version changes ([dcd5011](https://github.com/AsoBeast/asobeast/commit/dcd501145618bb8728a10412ee72aeab8ed6dc8b))
* **jobs:** sync apple search term popularity weekly ([5c2c27d](https://github.com/AsoBeast/asobeast/commit/5c2c27daace8f436c9c3c8ead328aeaaa7957ea4))
* **keywords:** rebucket keywords on the v2 score scale ([95d0d93](https://github.com/AsoBeast/asobeast/commit/95d0d932c22e3d61b930a49fb930f9fc7fc77eae))
* **keywords:** return score signals and the outdated formula flag ([1468f87](https://github.com/AsoBeast/asobeast/commit/1468f8700297514b9d17a435b59f33558194d1c6))
* **keywords:** shift opportunity by the app's chance in the top ten ([35ef1c5](https://github.com/AsoBeast/asobeast/commit/35ef1c5b410574c2e098e822f92efb3cb4447b17))
* **mcp:** describe v2 score signals in the keyword tools ([ec39fee](https://github.com/AsoBeast/asobeast/commit/ec39fee13fdebf064defe209633acc200d27e6f5))
* **scoring:** add rating velocity from the previous scored page ([6284611](https://github.com/AsoBeast/asobeast/commit/628461189827914c23e65b5f9771124fa76db0ab))
* **scoring:** add the apple ads popularity client ([7ca5e7f](https://github.com/AsoBeast/asobeast/commit/7ca5e7fae0894eee607f99882fb59acffc043d2b))
* **scoring:** adjust default relevance with ranking evidence ([262fa90](https://github.com/AsoBeast/asobeast/commit/262fa9057b646952f1b02627fd3d9b5ce5cb7747))
* **scoring:** estimate app store popularity from the search results ([01e6002](https://github.com/AsoBeast/asobeast/commit/01e60022732384ad358117d30015390ab213ee69))
* **scoring:** estimate traffic from suggest reach and real demand ([52ad418](https://github.com/AsoBeast/asobeast/commit/52ad418c4bedb25ee80e513cea7bead5076e1794))
* **scoring:** flag brand, weak leader and small result pages ([b4c86bd](https://github.com/AsoBeast/asobeast/commit/b4c86bd92037e9f25524aa977cafe739290d85f9))
* **scoring:** make opportunity multiplicative with a difficulty gate ([53e6cf6](https://github.com/AsoBeast/asobeast/commit/53e6cf69d0a27e5bcf23912ab7561b5cae428e9d))
* **scoring:** measure serp relevance, padding and medians ([99e5482](https://github.com/AsoBeast/asobeast/commit/99e5482904da92c6d18a9be2932e49b660727602))
* **scoring:** prefer official apple popularity and cap absent terms ([2d07211](https://github.com/AsoBeast/asobeast/commit/2d07211d4488e2d71c0d0a8bbfe2925875bedae5))
* **scoring:** probe suggest reach on both stores ([8a6b70b](https://github.com/AsoBeast/asobeast/commit/8a6b70b17f8fc203ac5ab07027ad9bfa249b4b38))
* **scoring:** rate difficulty on medians, dominance and serp flags ([3d9a655](https://github.com/AsoBeast/asobeast/commit/3d9a65572fb9632a13b3c78914672eb7e04f95cf))
* **scoring:** rebuild keyword scores on suggest reach and honest difficulty ([193f45c](https://github.com/AsoBeast/asobeast/commit/193f45c525a5b89a845fbe6cbb689458a279e5c3))
* **scoring:** report estimator agreement with apple popularity ([23294f0](https://github.com/AsoBeast/asobeast/commit/23294f0cadb75e68deb2c4465d14c82ba7df0d9d))
* **scoring:** score suggest reach by prefix length and position ([378ac6e](https://github.com/AsoBeast/asobeast/commit/378ac6eb89fbbaf4c87e53515add7aec6d11f98b))
* **scoring:** stamp v2 provenance and honest confidence ([b3d0851](https://github.com/AsoBeast/asobeast/commit/b3d0851be068340e21b1220191e9a6913b8ea525))
* **shared:** add a diacritic free search key ([9fd9706](https://github.com/AsoBeast/asobeast/commit/9fd97069b14f14d4185e3489ded52c6d64df2fc4))
* **shared:** add score signals and the outdated flag to the contract ([cdb9816](https://github.com/AsoBeast/asobeast/commit/cdb9816d95a3bb513fd7ce5f4a540e7d0b969fbf))
* **web:** call the traffic score popularity ([adb44d4](https://github.com/AsoBeast/asobeast/commit/adb44d4740bb6c579b4aeb62e9caab0b60acddf8))
* **web:** explain score signals in the score details ([1f8afd4](https://github.com/AsoBeast/asobeast/commit/1f8afd4b4941656dba450a03d03b07543e09f1fe))
* **web:** flag scores from an outdated formula ([ae6ccb7](https://github.com/AsoBeast/asobeast/commit/ae6ccb79cf648cf1b1c689a6df347cb3987b47e2))


### Bug Fixes

* **jobs:** retry an app store review feed that comes back empty ([3e4c4a0](https://github.com/AsoBeast/asobeast/commit/3e4c4a02f3f864170b415b2a89642832384b8a7d))
* **jobs:** retry an app store review feed that comes back empty ([497e25d](https://github.com/AsoBeast/asobeast/commit/497e25de76e1d6cc9ddeaa719248a187d40bc9a7))
* **keywords:** keep scores from an older formula out of buckets and actions ([15be537](https://github.com/AsoBeast/asobeast/commit/15be5370bcdec985cd19669cea1a0f537b545f03))
* **keywords:** keep the bucket of a score from an older formula ([56f12a9](https://github.com/AsoBeast/asobeast/commit/56f12a9895bdb7ea49ec39ec4288c7a3c96520e3))
* **keywords:** refuse a keyword field over 100 bytes ([edc57f6](https://github.com/AsoBeast/asobeast/commit/edc57f677e183f9e290d3d4d40b970508ee73d30))
* **keywords:** refuse a keyword field over 100 bytes ([b0dac6f](https://github.com/AsoBeast/asobeast/commit/b0dac6f796710b5e124f80d11cd27963d363f62b))
* **keywords:** weigh an app's chance only within its home market ([2c6dae9](https://github.com/AsoBeast/asobeast/commit/2c6dae94535fdbe67e9348cccde86c36ef75db57))
* **metadata:** compose keyword field draft phrases before packing ([5aab774](https://github.com/AsoBeast/asobeast/commit/5aab774129ea29a8c71a5b06cbf1a428c1f8fcf4))
* **metadata:** count the keyword field in bytes in audits and drafts ([e8a7248](https://github.com/AsoBeast/asobeast/commit/e8a72481d2b55b3e3c0908dc0e35fcd0e9203d46))
* **providers:** accept only a rating of 1 to 5 written as a string ([6ae208c](https://github.com/AsoBeast/asobeast/commit/6ae208caad6a00b53cb39776d9c8985fcfb658c5))
* **providers:** blame no proxy endpoint for an empty app store review feed ([d66e449](https://github.com/AsoBeast/asobeast/commit/d66e449a836f5753671648f1b24e4863f11325d8))
* **providers:** read app store reviews from the origin past the edge cache ([3a13012](https://github.com/AsoBeast/asobeast/commit/3a130126685dc1e41e465ac28f458cbca21545a5))
* **scoring:** accept the full developer name as the brand ([5807824](https://github.com/AsoBeast/asobeast/commit/58078242f8b37b607d8f909c93cb64476f7b2570))
* **scoring:** bound the apple popularity cap and ignore stale weeks ([0a7e55c](https://github.com/AsoBeast/asobeast/commit/0a7e55cb8d1a00beb0397b9f494fd14e1b6a32b8))
* **scoring:** fail an apple popularity week past the page limit ([4021995](https://github.com/AsoBeast/asobeast/commit/4021995b9256c12c3cb92313c60d366aa43eb64d))
* **scoring:** ignore a position below one as ranking evidence ([41a559c](https://github.com/AsoBeast/asobeast/commit/41a559c175e077566cc129419cd8b0e1ace160f3))
* **scoring:** keep a failed play detail lookup in its place ([fdaf52a](https://github.com/AsoBeast/asobeast/commit/fdaf52a0e0bfbc410343cbda1da16e5cb34bbe64))
* **scoring:** match google play completions on word boundaries ([8b6c399](https://github.com/AsoBeast/asobeast/commit/8b6c39934dc78eb6fcbdfb50ea56d1bfceb6d420))
* **scoring:** match google play suggestions by prefix ([c581c6c](https://github.com/AsoBeast/asobeast/commit/c581c6cba478fa5853a1580e789f0dcba7ea8f11))
* **scoring:** match plurals that double a z or turn y into ies ([2057b92](https://github.com/AsoBeast/asobeast/commit/2057b923280852d45e440629875ebf800120226d))
* **scoring:** match serp titles on whole words ([4af1fd4](https://github.com/AsoBeast/asobeast/commit/4af1fd434c3db8c72fa82dce52cee95c53686740))
* **scoring:** measure a brand leader against rivals that target the phrase ([e8c5fbd](https://github.com/AsoBeast/asobeast/commit/e8c5fbd1ac50462457ed24dc57befd1cd40688aa))
* **scoring:** score a phrase offered only when fully typed as listed ([502c7e0](https://github.com/AsoBeast/asobeast/commit/502c7e0b4b2fabe5716dca650c5505ce8e1eff5e))
* **scoring:** store the requested popularity week and name failures ([663f5f5](https://github.com/AsoBeast/asobeast/commit/663f5f535020bceb83103c0797c9ce7f681b9065))
* **shared:** count the keyword field in utf-8 bytes ([4240b5a](https://github.com/AsoBeast/asobeast/commit/4240b5ae1a0584626d631f37e9a61a96ffed9bb3))
* **shared:** fold diacritics only on latin and greek letters ([be73557](https://github.com/AsoBeast/asobeast/commit/be73557153a48c08c646d45fe658b677e2bb0041))
* **shared:** normalize keywords to nfc before tokenizing ([e98f947](https://github.com/AsoBeast/asobeast/commit/e98f947ec019ba8e22ce3c99fcd2d6ae48cec33b))
* **web:** count the keyword field in bytes ([2dd5e97](https://github.com/AsoBeast/asobeast/commit/2dd5e974e8cee970ff4ced7d5f52fae9c6589a91))
* **web:** describe a suggest hit without inventing its position ([35694a1](https://github.com/AsoBeast/asobeast/commit/35694a11ec889bc310c13058ccf7c274f80a2a9b))
* **web:** drop the cap wording when the apple popularity is shown ([7355bd7](https://github.com/AsoBeast/asobeast/commit/7355bd7ff7d3054ca33227acb27b6d4ac37c9f32))
* **web:** keep header actions clear of the breadcrumb on phones ([d3b86ce](https://github.com/AsoBeast/asobeast/commit/d3b86ceacd6701532c02a8ddf7fddfe03d1c61f2))
* **web:** keep header actions clear of the breadcrumb on phones ([856a3a2](https://github.com/AsoBeast/asobeast/commit/856a3a24626ca631c63274333fbb07ce2bf8b31b))


### Continuous Integration

* **repo:** squash merge pull requests and lint their titles ([#123](https://github.com/AsoBeast/asobeast/issues/123)) ([3cd1e27](https://github.com/AsoBeast/asobeast/commit/3cd1e27628583554687a33e89c87506806c3f6e1))

## [1.4.0](https://github.com/AsoBeast/asobeast/compare/v1.3.0...v1.4.0) (2026-09-18)


### Features

* **actions:** carry failing audit checks into fix factor evidence ([cb1b644](https://github.com/AsoBeast/asobeast/commit/cb1b644a04c1f807476a243f7f070671c7810f47))
* **api:** classify openai failures and control image detail ([a4ec900](https://github.com/AsoBeast/asobeast/commit/a4ec9007c24cdf250174e7ea7d5b66e60002bfc9))
* **api:** classify openai failures and control image detail ([1a6a462](https://github.com/AsoBeast/asobeast/commit/1a6a46268898135f1660771f42a33a62a8a594f9))
* **api:** default the ai model to gpt-5.6-luna ([88b4a41](https://github.com/AsoBeast/asobeast/commit/88b4a410e564dedb3dc1d90a03c44e8833bf8b67))
* **api:** store developer replies on google play reviews ([0db796f](https://github.com/AsoBeast/asobeast/commit/0db796fcfb5ed789c31a076e0a080d7e59fbacce))
* **api:** store developer replies on google play reviews ([0bef860](https://github.com/AsoBeast/asobeast/commit/0bef860c7958b8d02983df988c13b375e60087dd))
* **audit:** analyze creative with ai observations on a queue ([c863d96](https://github.com/AsoBeast/asobeast/commit/c863d968c0cba48911e5eab6e188cd57580a2666))
* **audit:** benchmark rating volume and recent reviews ([1eb2ec4](https://github.com/AsoBeast/asobeast/commit/1eb2ec43d11dccf3bef2b1b71794f65e3c8f5eae))
* **audit:** compare the listing with competitor benchmarks ([7cd3c62](https://github.com/AsoBeast/asobeast/commit/7cd3c62d1b2c7788f3ca6f4a755b365590333c30))
* **audit:** expose creative analysis runs over http ([06cbaa9](https://github.com/AsoBeast/asobeast/commit/06cbaa98a92a6e80a30e01afbe5567021ef168e7))
* **audit:** expose creative analysis runs over http ([0def8e3](https://github.com/AsoBeast/asobeast/commit/0def8e3e390a85a98b0f0e0fa83ee8e52638a56f))
* **audit:** name the keywords behind title, subtitle and field checks ([520f7be](https://github.com/AsoBeast/asobeast/commit/520f7bea1645a63725cc8c93222b95529ebfa7ec))
* **audit:** observe icon and screenshots instead of asking for scores ([289c883](https://github.com/AsoBeast/asobeast/commit/289c883221e15361d8b7ba520d6990e35f70a7fe))
* **audit:** observe icon and screenshots instead of asking for scores ([263cefb](https://github.com/AsoBeast/asobeast/commit/263cefbbcb7ad6aa5698194597cf1f9fd03bf7c6))
* **audit:** rank recommendations by score lift and effort ([882f36f](https://github.com/AsoBeast/asobeast/commit/882f36fb43993fb3559f2ef34df380e02499f3bf))
* **audit:** run the creative analysis on a queue with persisted state ([74253a5](https://github.com/AsoBeast/asobeast/commit/74253a5e98ef6489f9c2cb4679d2b73055c2bea5))
* **audit:** run the creative analysis on a queue with persisted state ([6f43728](https://github.com/AsoBeast/asobeast/commit/6f43728da4abc2bd92c84a8280acb46bc4b95ad3))
* **audit:** score google play short description and visual assets ([e072130](https://github.com/AsoBeast/asobeast/commit/e072130b6fc6350d4583f76e80efa8189d21ede5))
* **audit:** score keyword placement in google play descriptions ([e26b67a](https://github.com/AsoBeast/asobeast/commit/e26b67aa7f1cb3ba76a2c427e57cd1898e19bc49))
* **audit:** score listings with a deterministic v2 rubric ([3ef6ae7](https://github.com/AsoBeast/asobeast/commit/3ef6ae7ddab2c66577f7b9d63f9ac2cfbae5acea))
* **audit:** score rankings from visibility and competitor gaps ([be7ef52](https://github.com/AsoBeast/asobeast/commit/be7ef524043a269f19be541ead911bd7845a9b16))
* **audit:** score the review response rate on google play ([988c959](https://github.com/AsoBeast/asobeast/commit/988c9599e51f08909f563ab6fb67dfc72cae3d0e))
* **audit:** score the review response rate on google play ([8b05c61](https://github.com/AsoBeast/asobeast/commit/8b05c61f09df532a231b5163185c5ccdfb3a612f))
* **audit:** score update freshness, release notes and localizations ([d8f8223](https://github.com/AsoBeast/asobeast/commit/d8f822385fafa48f8692183f9cd8431517145607))
* **audit:** separate unmeasurable checks from checks awaiting input ([4c201ec](https://github.com/AsoBeast/asobeast/commit/4c201ecf7cbbca0c2e36528f3fc42372d2b588fb))
* **audit:** weight checks and report confidence, grade and groups ([a311b59](https://github.com/AsoBeast/asobeast/commit/a311b5984dab53590e509a9870ecc30c50238352))
* **db:** store audit rubric version, confidence and ai run state ([39a4a07](https://github.com/AsoBeast/asobeast/commit/39a4a0774c8533da4193b78d280a21001e8ea4ac))
* **mcp:** describe grades and recommendations in the audit tool ([8414cef](https://github.com/AsoBeast/asobeast/commit/8414cefb96619d0a80d52bbeadb3e96435aa50f9))
* **shared:** add optional audit v2 fields to the audit contract ([4919feb](https://github.com/AsoBeast/asobeast/commit/4919feb9e3563877aef36999a9504a46d3949033))
* **shared:** flag store policy terms in titles and short descriptions ([98784c2](https://github.com/AsoBeast/asobeast/commit/98784c214811314ae348debf40550354c7e5cbbc))
* **web:** choose the agent the connect snippets are written for ([754856f](https://github.com/AsoBeast/asobeast/commit/754856f61379f4c8f0cbc1fec28b2dd925e53002))
* **web:** compare the listing with competitors on the audit page ([27cddd5](https://github.com/AsoBeast/asobeast/commit/27cddd538055e027b5f3bc82082f1eb27f48d222))
* **web:** copy the audit as a markdown report ([c7bf1e0](https://github.com/AsoBeast/asobeast/commit/c7bf1e09bd66b87993aab3ba31391e694f2cfe09))
* **web:** describe the endpoint for any other mcp client ([e7369c2](https://github.com/AsoBeast/asobeast/commit/e7369c22da7f0aea6170f9cbf332b0dffc7d90af))
* **web:** lead the audit page with score, grade and confidence ([345f918](https://github.com/AsoBeast/asobeast/commit/345f918d9233e9dd39313ff129b049fc40cac229))
* **web:** rebuild the audit page around score, confidence and plan ([098e077](https://github.com/AsoBeast/asobeast/commit/098e0774c03bf5bad0c84229556eb3f86b087adc))
* **web:** run the creative analysis with live progress ([d5adeb2](https://github.com/AsoBeast/asobeast/commit/d5adeb2d01a3e0e7111759ae99ef52d42c7fbbd6))
* **web:** show factor checks with evidence, sources and unlocks ([402da99](https://github.com/AsoBeast/asobeast/commit/402da990a478195c7e9216c92173a85925032b55))
* **web:** show icon and screenshot observations from the analysis ([67a966a](https://github.com/AsoBeast/asobeast/commit/67a966a7ef07b9345614d9406d7ca8ad8b05ae51))
* **web:** show the audit action plan with lift, effort and fix links ([19ac870](https://github.com/AsoBeast/asobeast/commit/19ac870ea9e1720d792d2f96ca6245c1e7983bac))
* **web:** write a cursor connect snippet ([646aa1a](https://github.com/AsoBeast/asobeast/commit/646aa1aca46c023755060ab5c5d510f30e5ca634))
* **web:** write a vs code connect snippet ([5293781](https://github.com/AsoBeast/asobeast/commit/5293781682ac47d33bf539df09f9a3e02510ace9))
* **web:** write a windsurf connect snippet ([00f25f2](https://github.com/AsoBeast/asobeast/commit/00f25f224e1267e34330799194ab5a856fa9d30e))
* **web:** write codex connect snippets ([4e8ea85](https://github.com/AsoBeast/asobeast/commit/4e8ea85f4d472f23211974c9b9ce3af0d711f7d2))
* **web:** write gemini cli connect snippets ([c297072](https://github.com/AsoBeast/asobeast/commit/c297072459b51cc1558afb3b8dd68114dc0f8af3))
* **web:** write working connect snippets for every common mcp client ([7995eea](https://github.com/AsoBeast/asobeast/commit/7995eeafd0eedcdc0598265bb699d03dc2338acb))


### Bug Fixes

* **actions:** coalesce generation requests only while a run is pending ([933131b](https://github.com/AsoBeast/asobeast/commit/933131b8906074611212c16c464cde8039f1b199))
* **actions:** let generation run again and wait for the first checks ([31eac08](https://github.com/AsoBeast/asobeast/commit/31eac0816b0737b81d66d756ed9759135adfcda7))
* **actions:** record a generation run that opens no action ([6d37441](https://github.com/AsoBeast/asobeast/commit/6d37441df100d6cb811203de74a208645c28e9d9))
* **actions:** refuse a snooze date that is not on the calendar ([ff4d5d2](https://github.com/AsoBeast/asobeast/commit/ff4d5d2699c687c475c467cc78edc01831397cc8))
* **analytics:** refuse an impossible or reversed visibility window ([c4853a4](https://github.com/AsoBeast/asobeast/commit/c4853a4a914ac08dda4e45b22d23962dfcc5dd3c))
* **api:** answer get, head and delete on the mcp endpoint with 405 ([01c1ca7](https://github.com/AsoBeast/asobeast/commit/01c1ca791f9e75bc9afaacf305993f5c029475a3))
* **api:** challenge every 401 with a bearer www-authenticate header ([3b793d2](https://github.com/AsoBeast/asobeast/commit/3b793d223568758ebe4d54579eed2e411376a455))
* **api:** refuse a market that is not a storefront of the app's store ([4b9ba1c](https://github.com/AsoBeast/asobeast/commit/4b9ba1c565f4797c79189bdea9622d1f75a4dd34))
* **api:** refuse an impossible or reversed category rank window ([02d9ff8](https://github.com/AsoBeast/asobeast/commit/02d9ff835d336b64fe6574c4189975207db1fa7a))
* **api:** retry openai failures only on transient statuses ([f7468f8](https://github.com/AsoBeast/asobeast/commit/f7468f85ca1d34d8e9641238119315e1984950a9))
* **api:** retry openai failures only on transient statuses ([bc9aff8](https://github.com/AsoBeast/asobeast/commit/bc9aff8599352bb2a5a63770e0d466a0ca2579ca))
* **apps:** backfill a subtitle the import could not read ([c6a5e7e](https://github.com/AsoBeast/asobeast/commit/c6a5e7e323c459dbcfb98957e58e1a762f0c5051))
* **apps:** backfill a subtitle the import could not read ([c2ff1b8](https://github.com/AsoBeast/asobeast/commit/c2ff1b856911b3e97d4eaa6716e1031698ee6569))
* **apps:** generate the first action run after the first rank checks ([f7c1a73](https://github.com/AsoBeast/asobeast/commit/f7c1a73bb547feed5fdf6ae72a3df608f519a824))
* **apps:** keep the history of an app that is already tracked ([7e33885](https://github.com/AsoBeast/asobeast/commit/7e338852afc20ce21ed68f9f0bed894b7e1510d9))
* **apps:** keep the last known subtitle when a refresh cannot read it ([848f110](https://github.com/AsoBeast/asobeast/commit/848f110eed7475786477727b55bd5f26f0d7a5ba))
* **apps:** rank the keywords a backfilled subtitle adds ([d664ba2](https://github.com/AsoBeast/asobeast/commit/d664ba25b5f588acb17e8d0ac238f37b90cb64a5))
* **apps:** refuse an app that cannot rank in app store search ([558bbca](https://github.com/AsoBeast/asobeast/commit/558bbca60f13d991b49a14d62d6067fbb3b8f475))
* **audit:** check app ownership before sharing a legacy analysis in flight ([7b00826](https://github.com/AsoBeast/asobeast/commit/7b00826a7192aac33815f0813ddfe7115a9803b4))
* **audit:** correct keyword matching, gap scope and rounding in checks ([2af4d08](https://github.com/AsoBeast/asobeast/commit/2af4d0887ade70299adc6b28cc58705220eae607))
* **audit:** count overlapping keyword repeats once per mention ([c9f5e75](https://github.com/AsoBeast/asobeast/commit/c9f5e7575a5cfe8e1190fa078b7e92edec87bde9))
* **audit:** fail a creative run that could not be queued ([a3b289f](https://github.com/AsoBeast/asobeast/commit/a3b289fe71e608fe6f126625339d5bbe8507dedc))
* **audit:** fail a creative run that could not be queued ([8b6d65e](https://github.com/AsoBeast/asobeast/commit/8b6d65e744b9f343d25582a84d148eb79d41fa94))
* **audit:** fingerprint competitor icons in the order they were sent ([ff70776](https://github.com/AsoBeast/asobeast/commit/ff7077602add959f7153a0173513e6f3bc38b7ba))
* **audit:** flag changed creative as stale without a configured model ([15db2e0](https://github.com/AsoBeast/asobeast/commit/15db2e08e30335874837d4cca94cb2b7081a8037))
* **audit:** flag changed creative as stale without a configured model ([33abb0f](https://github.com/AsoBeast/asobeast/commit/33abb0f213c62936227202ca9ed5d917c2076362))
* **audit:** keep a finished creative analysis when its score snapshot fails ([a8adf4b](https://github.com/AsoBeast/asobeast/commit/a8adf4b8f15a125d381c7e3d48da32ee84be1d85))
* **audit:** keep a finished creative analysis when its score snapshot fails ([9c5cb01](https://github.com/AsoBeast/asobeast/commit/9c5cb014a14bc257ac1c1313721a70b81bc6ebe8))
* **audit:** keep creative runs consistent across overlapping requests ([3e55532](https://github.com/AsoBeast/asobeast/commit/3e555328222b8762edab38c352e6bf505de19c4f))
* **audit:** let a creative job claim only the run it was queued for ([97be0e5](https://github.com/AsoBeast/asobeast/commit/97be0e56141b6711e05080e01508bc3801c25764))
* **audit:** refuse an impossible or reversed audit history window ([feaee88](https://github.com/AsoBeast/asobeast/commit/feaee883a22159d0c29b46af46f57db04304f5f1))
* **audit:** resolve creative observations against the images actually sent ([1490020](https://github.com/AsoBeast/asobeast/commit/149002098aff4d3a4370ae1a0c914e28f0764956))
* **audit:** sample captions from the first screenshot positions ([7fa288a](https://github.com/AsoBeast/asobeast/commit/7fa288a2331d93ab231e6668f91a101f88dfc11b))
* **audit:** sample captions from the first screenshot positions ([82edfa5](https://github.com/AsoBeast/asobeast/commit/82edfa5f1140ed50f56a77e9832c571eb3bd2597))
* **audit:** show a stale creative analysis with the media it analyzed ([ed66f34](https://github.com/AsoBeast/asobeast/commit/ed66f3497aa9f7b727f6ef92d02b8e495333e42f))
* **audit:** show the similar icon competitor from the analyzed list ([6d7418a](https://github.com/AsoBeast/asobeast/commit/6d7418ab619f114fa6007a067273a8f8de442868))
* **auth:** accept the bearer scheme in any letter case ([9ab3a3b](https://github.com/AsoBeast/asobeast/commit/9ab3a3bda3869f564dd96de9035a2fe6f466d211))
* **auth:** tell a throttled auth request how long to wait ([0ff9265](https://github.com/AsoBeast/asobeast/commit/0ff926505b25b6aaa297a5354df2e3ba666980c6))
* **auth:** tell a throttled request how long to wait ([4c521e9](https://github.com/AsoBeast/asobeast/commit/4c521e9e97f132624f132a57d11029f1c00385fb))
* **db:** canonicalize app store ids stored with leading zeros ([b7e4f82](https://github.com/AsoBeast/asobeast/commit/b7e4f826d73db29d076ebffa7effef5133e3bafa))
* **db:** canonicalize only one of the padded ids that share a listing ([ac45d94](https://github.com/AsoBeast/asobeast/commit/ac45d9430e0c212700d96b2048fd29ac6dd8c80a))
* **db:** deactivate keywords tracked outside a storefront ([a946b0a](https://github.com/AsoBeast/asobeast/commit/a946b0a8a14cd38d0cb49154d9a299ffe4e93596))
* **db:** decode the apostrophe escape in stored play short descriptions ([d24f38e](https://github.com/AsoBeast/asobeast/commit/d24f38ea75d11dab9549ec955fcf5cef50150199))
* **db:** decode the play short descriptions already stored ([a1b036b](https://github.com/AsoBeast/asobeast/commit/a1b036b4c4c6451643d4fd67a27fa49e52539c28))
* **db:** untrack escape keywords from every stored play summary ([dabc012](https://github.com/AsoBeast/asobeast/commit/dabc0120a11a3c5c442ccb0ce093d41e02790146))
* **db:** untrack the keywords a play short description escape produced ([7a06702](https://github.com/AsoBeast/asobeast/commit/7a06702910e8c9eaed34435a5f28e9d4d4ca016f))
* explain stdio misconfiguration and refuse impossible dates ([f18d10c](https://github.com/AsoBeast/asobeast/commit/f18d10cbbc2d5878660c712d617dac3d9f783461))
* **jobs:** keep the listing stage waiting while its subtitle backfills ([c5283b0](https://github.com/AsoBeast/asobeast/commit/c5283b04f1523c5779a3bc9d0b43c86bfccacc72))
* **jobs:** refuse a subtitle backfill without an app or snapshot id ([87a4f2e](https://github.com/AsoBeast/asobeast/commit/87a4f2e7a52f2e7beeb8d3d3914e62c93ef7ab44))
* keep mcp answers intact and conformant through the web proxy ([e2d5579](https://github.com/AsoBeast/asobeast/commit/e2d557950bdd6c6d9fb69267d00347fd3f649048))
* **keywords:** discard a queued probe for a market outside the storefront ([cc830c4](https://github.com/AsoBeast/asobeast/commit/cc830c4149cab0b2ade2a13761f677d10ddd8748))
* mark auth form fields, count the keyword field and refuse mac only apps ([f608d9d](https://github.com/AsoBeast/asobeast/commit/f608d9d4fc149c9c9cc1eb7a04d04c73e037f901))
* **mcp:** accept a json content type in any letter case ([6215613](https://github.com/AsoBeast/asobeast/commit/6215613cc09f826b98d8ee88c71fbbc81a435b43))
* **mcp:** accept a token pasted with quotes or a bearer prefix ([a73b6a3](https://github.com/AsoBeast/asobeast/commit/a73b6a3a4aec86bf256341c4572406ff0752c29d))
* **mcp:** explain an api url that answers with something other than json ([22cc543](https://github.com/AsoBeast/asobeast/commit/22cc5435a8eca83844f8d931ccafa73239b595d0))
* **mcp:** name the api url variable and the form it needs when invalid ([81dcbdb](https://github.com/AsoBeast/asobeast/commit/81dcbdbf183659a0942bbada022beecb5b4c547a))
* **mcp:** name the rest api url when given the mcp endpoint instead ([760c669](https://github.com/AsoBeast/asobeast/commit/760c669c01b1a4fdbd5834585b8b90ba3d52affb))
* **mcp:** never carry the api token across a redirect ([d406486](https://github.com/AsoBeast/asobeast/commit/d406486f6204ab61e666c229ac8feb00144f0f52))
* **mcp:** refuse a tool date that is not on the calendar ([b8d22b3](https://github.com/AsoBeast/asobeast/commit/b8d22b39daa3bcec35cb78f7372b6de94c1fc7fa))
* **mcp:** refuse an api url with a query, fragment or credentials ([087deda](https://github.com/AsoBeast/asobeast/commit/087dedad5d5250f3e75c4e77e36b612628a0ba7c))
* **mcp:** warn when the api token would travel over plain http ([443bef6](https://github.com/AsoBeast/asobeast/commit/443bef63a3eb042861af8829d6c4f9489fb4f7ce))
* **providers:** decode html entities in the play short description ([e66a782](https://github.com/AsoBeast/asobeast/commit/e66a7829def304a87ce285968c9abf90f4ac6635))
* **providers:** decode html entities in the play short description ([e7b41fd](https://github.com/AsoBeast/asobeast/commit/e7b41fd9875d2db334071d59f31afb0b4d52a923))
* **providers:** decode only the escapes the play store page emits ([1028407](https://github.com/AsoBeast/asobeast/commit/1028407dcbc621edde46e6eac83fdb373aa0f357))
* **providers:** ignore an unreadable google play reply date ([0bef94b](https://github.com/AsoBeast/asobeast/commit/0bef94bf45de1a98c128d5994fdffd439ceb7a32))
* **providers:** tell an unreadable product page from a missing subtitle ([13a8735](https://github.com/AsoBeast/asobeast/commit/13a8735dfb247183def0b9f6f2d22b924768ad35))
* **rankings:** refuse a serp snapshot date that is not on the calendar ([ca8fa1e](https://github.com/AsoBeast/asobeast/commit/ca8fa1e6fdecc8760f391fa3986843dec5581f9f))
* **rankings:** refuse an impossible or reversed ranking history window ([274c5a6](https://github.com/AsoBeast/asobeast/commit/274c5a6c2a0a08e74976ed539c27c70ebadec458))
* send costly submissions once and keep tracked app history ([88e1cc1](https://github.com/AsoBeast/asobeast/commit/88e1cc1d973605f357450cc71611b91ca1892c3b))
* **shared:** accept a store url without a scheme and refuse non listing pages ([032fee7](https://github.com/AsoBeast/asobeast/commit/032fee77920705e51217a355f747d01f47d34b73))
* **shared:** count the keyword field limit in bytes like apple does ([6df2328](https://github.com/AsoBeast/asobeast/commit/6df2328206e01e725f7d8c0c377eed3f969c7c91))
* **shared:** ignore inherited keys in the storefront language table ([bb33dbd](https://github.com/AsoBeast/asobeast/commit/bb33dbda27da68f1e70b68e10c5188d1df43065a))
* **shared:** know where each store operates ([94f7515](https://github.com/AsoBeast/asobeast/commit/94f7515a5d156485acb67820ca76144a1d79f8c6))
* **shared:** refuse a store url whose storefront does not exist ([38b0b8a](https://github.com/AsoBeast/asobeast/commit/38b0b8a515911c98c575ffb5e1af5efd72c01c37))
* **shared:** resolve an app store id with leading zeros to its listing ([d060b2b](https://github.com/AsoBeast/asobeast/commit/d060b2bde93c8311db78034b7e6f4efb8684e3ca))
* **shared:** stop reporting trademark symbols as emoji in play titles ([60fb758](https://github.com/AsoBeast/asobeast/commit/60fb75859215db4261aaa14d5ac5d0ebe07908cf))
* validate store ids, urls and storefronts before reaching a store ([da8ee8f](https://github.com/AsoBeast/asobeast/commit/da8ee8fa631b205eb12e4ecc6240b7d827b520ad))
* **web:** announce a scheduled workspace deletion on every app page ([6a2b051](https://github.com/AsoBeast/asobeast/commit/6a2b0511f6abecbccec7f11752a0c2147d46ccde))
* **web:** announce analysis progress once and keep focus on page load ([bfe363f](https://github.com/AsoBeast/asobeast/commit/bfe363f7bddf3ea00d1c25e59c6d2d11780d5b6c))
* **web:** answer oauth discovery probes with a json 404 ([b2e48a6](https://github.com/AsoBeast/asobeast/commit/b2e48a6a836cebe9efd62e8bbaea69589299cf17))
* **web:** cancel the upstream request when the client disconnects ([eb3de5d](https://github.com/AsoBeast/asobeast/commit/eb3de5da01e87f69ad6b2205a335d40a7cba066b))
* **web:** connect claude desktop through mcp-remote ([d1a426a](https://github.com/AsoBeast/asobeast/commit/d1a426ae3efce5873be520e8a104f8b39b12dcf1))
* **web:** count the keyword field the way it is stored ([2a92401](https://github.com/AsoBeast/asobeast/commit/2a924017f60e71822d30343549647af632cad81e))
* **web:** end the proxy deadline when the api starts answering ([a6b3c3f](https://github.com/AsoBeast/asobeast/commit/a6b3c3fb326cda29719ef49606f923186f43f2df))
* **web:** give claude code a json snippet add-json accepts ([73270e9](https://github.com/AsoBeast/asobeast/commit/73270e96ddf5259de523b2150f5ebb4f88cfe513))
* **web:** let a failed audit load reach the error boundary ([3d64893](https://github.com/AsoBeast/asobeast/commit/3d6489361036738aca48fc968b6f89c7da78865c))
* **web:** let the action center generate again and follow the run ([e7948ee](https://github.com/AsoBeast/asobeast/commit/e7948ee586bf849091b83e0213e5d610f4a456a3))
* **web:** let the import dialog accept every form the parser accepts ([49ec4fd](https://github.com/AsoBeast/asobeast/commit/49ec4fd4560aed63a6725e8c56c073eec9b9de79))
* **web:** mark only the field an auth form error is about ([f3a0b10](https://github.com/AsoBeast/asobeast/commit/f3a0b1016826202818d9b6951580098c0bec64db))
* **web:** name an unavailable screenshot for assistive technology ([0985407](https://github.com/AsoBeast/asobeast/commit/09854071d88bf1b7eb9f54044e0a473f4f42018b))
* **web:** name the comparison column of the markdown report ([f408279](https://github.com/AsoBeast/asobeast/commit/f40827951ebc51d488e172852ad28989641b46b6))
* **web:** never show a missing recommendation lift as zero points ([1cff6aa](https://github.com/AsoBeast/asobeast/commit/1cff6aac9e8b0868d9d57fbbcfe71a644a4bd68d))
* **web:** offer no action on an analysis that is already current ([83d1d40](https://github.com/AsoBeast/asobeast/commit/83d1d40cb5c3aacc12095c5738c37db2c74c3abd))
* **web:** quote the stdio entrypoint so a path with spaces still starts ([1aec273](https://github.com/AsoBeast/asobeast/commit/1aec273b7d5384b366b0a6ac01a73f93a0d813a7))
* **web:** read older audits and keep the markdown report well formed ([87aaa0f](https://github.com/AsoBeast/asobeast/commit/87aaa0f44bbfc339d0dbe1da986c91edb353a7e0))
* **web:** refetch the listing once its subtitle backfill lands ([eca93d2](https://github.com/AsoBeast/asobeast/commit/eca93d273bd86584f7135fdcb65dca10ee66b9a3))
* **web:** refuse a market that is not a storefront before sending it ([3b7d1a3](https://github.com/AsoBeast/asobeast/commit/3b7d1a39b0afe2fdac07bef0b78dd6db63b6b995))
* **web:** release the submission guard when its request settles ([3debe81](https://github.com/AsoBeast/asobeast/commit/3debe8131a7fec7e12020b6b6c80db99631d49a4))
* **web:** return the allow and www-authenticate headers from the api ([85bcc56](https://github.com/AsoBeast/asobeast/commit/85bcc56109ebd39f66b356555a0c8d657ff96366))
* **web:** return the wait and the rate limit window through the proxy ([026a817](https://github.com/AsoBeast/asobeast/commit/026a8173e63dfcaa61ab6d27beceb77d5eb7130d))
* **web:** say where each snippet goes and what it needs ([83ae0cf](https://github.com/AsoBeast/asobeast/commit/83ae0cf132812315b07003355d79e4af742c420e))
* **web:** schedule and cancel workspace deletion from settings ([ad12ce8](https://github.com/AsoBeast/asobeast/commit/ad12ce8894efe4b751a902dff052dc7ee7c2daf9))
* **web:** send an import or a delete once however fast it is clicked ([e2d4e83](https://github.com/AsoBeast/asobeast/commit/e2d4e83f68661d6ded2bfed2bb7146dec6602166))
* **web:** send every costly submission once however fast it is clicked ([580b57c](https://github.com/AsoBeast/asobeast/commit/580b57c49069c7de9aef9e0f47df9dc891bec150))
* **web:** show and control a scheduled workspace deletion ([49d9f2c](https://github.com/AsoBeast/asobeast/commit/49d9f2c4b1ff9e13f01761e950e55ad436d79204))
* **web:** show missing benchmark data and keep queued runs polling ([34cca8c](https://github.com/AsoBeast/asobeast/commit/34cca8c83649a7b13bf3cbff8e136b511d1d3615))
* **web:** wait for the account before showing deletion controls ([f5c3d0f](https://github.com/AsoBeast/asobeast/commit/f5c3d0fdc928df3568e908b708869c527c631cdf))
* **web:** write connect snippets before the browser origin is known ([db6ff79](https://github.com/AsoBeast/asobeast/commit/db6ff79840aa9186990addecd8f78bd5a09d8eed))


### Performance

* **api:** answer remote tool calls with the shared compact text ([20e1b2e](https://github.com/AsoBeast/asobeast/commit/20e1b2e302262dbad06a336ab32dacd6127166e2))
* **mcp:** serialise tool results once, without indentation ([cbed474](https://github.com/AsoBeast/asobeast/commit/cbed47482819a4a9adc2958eb54422d2949f9c3f))
* **mcp:** serialise tool results once, without indentation ([6906208](https://github.com/AsoBeast/asobeast/commit/6906208294461fa180198adb4dc0752e4b3d6d64))


### Refactoring

* **actions:** narrow audit snapshot rows with a record guard ([404f2ae](https://github.com/AsoBeast/asobeast/commit/404f2ae600acef911dc45578b476ec9021d0efaa))
* **api:** narrow the reply check date instead of asserting it ([2828453](https://github.com/AsoBeast/asobeast/commit/2828453d75dfc1075eaeff39e970bcdf7abd28b2))
* **api:** narrow the reply check date instead of asserting it ([541a4ae](https://github.com/AsoBeast/asobeast/commit/541a4aefbc4e5dc8e38454f9493eaea0c8c788e9))
* **api:** read the earlier window bound without a type assertion ([ff6cb03](https://github.com/AsoBeast/asobeast/commit/ff6cb035971c4e99a7fd3536f79df11464b7a9b3))
* **audit:** count visible screenshots without a type assertion ([c5acbc5](https://github.com/AsoBeast/asobeast/commit/c5acbc50394118973b6782a74f0b82318c52b23e))
* **audit:** drop an unused history unlock ([0f766b2](https://github.com/AsoBeast/asobeast/commit/0f766b27eb65df7261484dd0d7d3342ff6945352))
* **audit:** narrow creative runs and captions instead of asserting ([f16fcdc](https://github.com/AsoBeast/asobeast/commit/f16fcdc0fad7368f2d6b369aa5aa104bee177ff3))
* **audit:** narrow creative runs and captions instead of asserting ([209ec68](https://github.com/AsoBeast/asobeast/commit/209ec68ae0bab39e57d245f7fb02c4dfef0a5ee6))
* **audit:** split audit checks and context loading into modules ([7077cae](https://github.com/AsoBeast/asobeast/commit/7077caef69febd66e3665c7bb6ef858f41efadee))
* **auth:** move bearer credential parsing into its own module ([0cd397d](https://github.com/AsoBeast/asobeast/commit/0cd397d6512e6b7bcf4e9c425bd9ac5207cdcf35))
* **providers:** lift the storefront language map into shared ([829c3f7](https://github.com/AsoBeast/asobeast/commit/829c3f78e6ca733ae7fe1dfc8fc504d1ea3db6ad))
* **shared:** share the keyword field parse and count with the web app ([2854469](https://github.com/AsoBeast/asobeast/commit/28544696f5dfdc3db99da973617d16b344292377))
* **web:** describe connect snippets as one typed list ([03fb8e0](https://github.com/AsoBeast/asobeast/commit/03fb8e02ee9e73b947bbad4b949a525c4ec67184))
* **web:** keep the chosen mcp agent in the url without a type assertion ([b6b576b](https://github.com/AsoBeast/asobeast/commit/b6b576bbbeda78dca5754b06ba5702ff48904197))
* **web:** name the listing invalidation set in the query layer ([2b29d57](https://github.com/AsoBeast/asobeast/commit/2b29d57d99aaf65c0730729cc8e497b7e150c697))
* **web:** narrow the audit creative instead of asserting it ([9a0b79f](https://github.com/AsoBeast/asobeast/commit/9a0b79f551c0e75330e21c623868d18edc92c5f7))
* **web:** read the audit through the query cache ([3acd7ea](https://github.com/AsoBeast/asobeast/commit/3acd7ea4f43714b9ace603db63dfdf4995771891))
* **web:** share audit status bands, bucket order and report sections ([7f4c8cf](https://github.com/AsoBeast/asobeast/commit/7f4c8cff804931ab55486d56534f97f4c51128b9))


### Documentation

* **docker:** stop suggesting an insecure cookie for plain http hosts ([a93151a](https://github.com/AsoBeast/asobeast/commit/a93151adc31d0330224826450ea131a676525c9d))
* **docs:** connect codex, cursor, vs code, gemini cli and windsurf ([9ff6154](https://github.com/AsoBeast/asobeast/commit/9ff61546594ffca7f9f3e16a3eb2d4ed510ecea6))
* **docs:** describe deleting a workspace from settings ([ade9e50](https://github.com/AsoBeast/asobeast/commit/ade9e50b0c64999633d22d5394f9e076b0038167))
* **docs:** describe how sign in throttling answers ([8282c70](https://github.com/AsoBeast/asobeast/commit/8282c7052ad2e85270f6f9250d210e0995f62af2))
* **docs:** describe the proxy timeout as a deadline for the first byte ([84d0093](https://github.com/AsoBeast/asobeast/commit/84d0093f1ccfdc1dc75c0502f27929b83d3ad0b6))
* **docs:** document audit v2 scoring and the creative analysis ([608b989](https://github.com/AsoBeast/asobeast/commit/608b98969ca653e2bc52529a10d33c0db24d9bb5))
* **docs:** explain a subtitle that fills in shortly after import ([fa710b1](https://github.com/AsoBeast/asobeast/commit/fa710b16e96f8622978626610c0ea3a0d9c063c3))
* **docs:** explain the 401 challenge, 405 and discovery answers ([dde7167](https://github.com/AsoBeast/asobeast/commit/dde7167e8d5658b18550c4db11a36cc11b8137a6))
* **docs:** give plain http operators options that boot ([2ee1985](https://github.com/AsoBeast/asobeast/commit/2ee198533ff7cf8359f76303e645c91980bc8d92))
* **docs:** list each stdio configuration message and its fix ([d24a314](https://github.com/AsoBeast/asobeast/commit/d24a3145ce5e7cbf5ba0b6f7f73db998ba2d3060))
* **docs:** list every input the import dialog accepts ([876608f](https://github.com/AsoBeast/asobeast/commit/876608f91d3e74cb929e4e9c4963292248a360e6))
* **docs:** list the queue and generic openai failure messages ([5d4230f](https://github.com/AsoBeast/asobeast/commit/5d4230f462316d17e39db92401e045b75050230d))
* **docs:** say that adding a tracked competitor again is free ([91a8857](https://github.com/AsoBeast/asobeast/commit/91a8857be1235895335e029ec2658dfa6627dd96))
* **docs:** say when the action queue is generated and regenerated ([8886ed8](https://github.com/AsoBeast/asobeast/commit/8886ed8f80ee347e5bb9106b3f0b449c5e5576c2))
* **docs:** show claude desktop and claude code snippets that connect ([9f1cabf](https://github.com/AsoBeast/asobeast/commit/9f1cabf943b55cdf947a80ce38a02a414fed6e88))
* **docs:** state that dates must exist and windows must run forwards ([d51f446](https://github.com/AsoBeast/asobeast/commit/d51f446ae973fdacfe344cc664f1d0d0d101a24d))
* **docs:** state that the play short description is stored as plain text ([d7e270c](https://github.com/AsoBeast/asobeast/commit/d7e270c05ead1beb731cfcd0100b316a1f1160c7))
* **docs:** state the compose cookie default where pages assume it is off ([26c7953](https://github.com/AsoBeast/asobeast/commit/26c7953a225151fa155fc44e38a74aef2e5a76a4))
* **docs:** state where each store operates and how to clear old failures ([af28f6b](https://github.com/AsoBeast/asobeast/commit/af28f6bfdbbf1c30d613fb5eddc4d86c2adbe3c6))
* **docs:** state which app store listings asobeast can track ([b906ce2](https://github.com/AsoBeast/asobeast/commit/b906ce2f42e9c07d59aa198f223f4761dea59217))
* give plain http operators cookie guidance that boots ([f30554a](https://github.com/AsoBeast/asobeast/commit/f30554acfe59bc7cc6a8b351f8e2a713e299b2f7))
* **repo:** describe the mcp wire check for release qa ([c417f8f](https://github.com/AsoBeast/asobeast/commit/c417f8f3dbd9047bc6a684986fd3c453862c6399))

## [1.3.0](https://github.com/AsoBeast/asobeast/compare/v1.2.0...v1.3.0) (2026-09-13)


### Features

* **api:** reconcile a workspace before refusing its checkout ([0a39ee3](https://github.com/AsoBeast/asobeast/commit/0a39ee304e1cfc160adc13b5c6f66ba604c4a70f))
* **shared:** carry the recovery a billing conflict needs ([8c3a7a5](https://github.com/AsoBeast/asobeast/commit/8c3a7a548852b7cc6446bedcc68026b278ba3ab8))
* **web:** reconcile the workspace when a checkout returns ([9118c2e](https://github.com/AsoBeast/asobeast/commit/9118c2e196809418052140eb320794510ac5831f))
* **web:** show the release version in the sidebar footer ([972fb3f](https://github.com/AsoBeast/asobeast/commit/972fb3f4fd459953d4e7c76196d0bba541c61258))
* **web:** show the release version in the sidebar footer ([f4e25f4](https://github.com/AsoBeast/asobeast/commit/f4e25f40dd30fb28610fb1ccefc09263d207d821))


### Bug Fixes

* **actions:** answer 404 for an unknown app in the action route ([6bfc29c](https://github.com/AsoBeast/asobeast/commit/6bfc29cd9526a458a15eb3db1e7c531d8fc802d7))
* **actions:** answer 404 for an unknown app in the action route ([3359ec8](https://github.com/AsoBeast/asobeast/commit/3359ec891865108f15cc8ce8f764d712b3cfc9c8))
* **api:** adopt the subscription stripe already links to the workspace ([17e45e3](https://github.com/AsoBeast/asobeast/commit/17e45e31a086dd872123c2e241ffc581a12fc06e))
* **api:** close the gaps a review found in the recovery path ([75f2529](https://github.com/AsoBeast/asobeast/commit/75f25294b3637a2454a0b352c6a0acb22e7900c8))
* **api:** recover a workspace whose subscription no webhook recorded ([08225c3](https://github.com/AsoBeast/asobeast/commit/08225c3c60912d52521d849d2e01855e62e4da1a))
* **api:** revoke only a workspace that claims a subscription ([b45f542](https://github.com/AsoBeast/asobeast/commit/b45f5424e724b993dec8d5660b6ccba846a5cd81))
* **api:** stop a dead subscription shadowing the recovery ([470668d](https://github.com/AsoBeast/asobeast/commit/470668d833bffba3fea8b81935326ad2d5528b5e))
* **api:** tell a stalled subscription what it is missing ([e47677e](https://github.com/AsoBeast/asobeast/commit/e47677e6ef7797697cb067d68711c8419509988d))
* **auth:** count password characters by code point ([6b5c585](https://github.com/AsoBeast/asobeast/commit/6b5c5852718bf95ab125306b032297c2f7bd4df1))
* **auth:** refuse a password that is only whitespace ([145c469](https://github.com/AsoBeast/asobeast/commit/145c469b8416bf5a5a96e1c09ba02debdccfdb3a))
* **auth:** refuse a password that is only whitespace ([b5e468f](https://github.com/AsoBeast/asobeast/commit/b5e468fd5a1cb668c1c5fb2b7facd259762a057f))
* **ci:** build workspace packages before linting ([996c368](https://github.com/AsoBeast/asobeast/commit/996c368dd275acd698c4c7d87604935678bb1d6d))
* **keywords:** insert new keyword rows in one order so saves cannot deadlock ([ba38a0e](https://github.com/AsoBeast/asobeast/commit/ba38a0efac9340faa825c06d97037a66f064a3f2))
* **keywords:** insert new keyword rows in text order so writes cannot deadlock ([ab3ab7b](https://github.com/AsoBeast/asobeast/commit/ab3ab7b3cc74b061856f027947fb03a453604907))
* **keywords:** make keyword inserts deadlock free and keep the field in saved order ([0b70e22](https://github.com/AsoBeast/asobeast/commit/0b70e22dc2960d1a9d8c279458cd4b583c3fabdf))
* **keywords:** read the keyword field in the order it was saved ([bcd801f](https://github.com/AsoBeast/asobeast/commit/bcd801fc34398063b70387b29ea8ee62fca53966))
* **keywords:** record keyword field membership apart from the keyword source ([d4f5cf4](https://github.com/AsoBeast/asobeast/commit/d4f5cf47a05143f349b54e049f795c359021ff11))
* **keywords:** record keyword field membership apart from the keyword source ([b4392c6](https://github.com/AsoBeast/asobeast/commit/b4392c6f9ad0099a19dac0daa8a934fb80415b31))
* **keywords:** refuse a keyword field over the 100 character limit ([09ab7b9](https://github.com/AsoBeast/asobeast/commit/09ab7b97d28b04ff451d710c4132dc008de11d21))
* **keywords:** serialize concurrent keyword field saves per app ([c47a0b9](https://github.com/AsoBeast/asobeast/commit/c47a0b9a1355c54b877b0fc6531fe4f589d13ef7))
* **keywords:** serialize the keyword field write per app ([13fd4e3](https://github.com/AsoBeast/asobeast/commit/13fd4e3a9e687fb44de102c58a00128e625a55f1))
* **repo:** close the advisories the dependency tree carries ([f842557](https://github.com/AsoBeast/asobeast/commit/f842557dcaeea387f8f446064d7237d7f892386b))
* **repo:** keep generated env files private and node recoverable ([5d42222](https://github.com/AsoBeast/asobeast/commit/5d42222db01d432e1de3454969b6fb82c63eae9e))
* **repo:** let prisma fetch the schema engine at install ([9263f52](https://github.com/AsoBeast/asobeast/commit/9263f524da497326382c9a9ebdc126e7120ec59d))
* **shared:** lowercase a capital dotted I without splitting the word ([367125a](https://github.com/AsoBeast/asobeast/commit/367125adca67190a084f310df5676cd8229255fe))
* **shared:** lowercase a capital dotted I without splitting the word ([e2faffa](https://github.com/AsoBeast/asobeast/commit/e2faffa42fcf7266565ca96a08bdea3a17f19d40))
* **shared:** lowercase a dotted I written with a combining dot as one letter ([3da7b9c](https://github.com/AsoBeast/asobeast/commit/3da7b9c276e8bc879bd57b934dbd1a34620b1c9a))
* **web:** check the whole password rule and link its error to the field ([ca5d5b2](https://github.com/AsoBeast/asobeast/commit/ca5d5b2341fe6ed3a5ce3cdcb2f32ec98af908c3))
* **web:** clamp displayed keyword scores to their 0 to 100 scale ([e9831a1](https://github.com/AsoBeast/asobeast/commit/e9831a1ca8b22c1b2c98c318cebce4458371e1b3))
* **web:** clamp the comparison matrix scores to their 0 to 100 scale ([c42bf17](https://github.com/AsoBeast/asobeast/commit/c42bf172c03836716c8c5cb0011a8982e501112e))
* **web:** clamp the displayed difficulty to its 0 to 100 scale ([968af05](https://github.com/AsoBeast/asobeast/commit/968af0595507297e781a911b4ad96a6f2b9e9d71))
* **web:** fall back to the letter placeholder when a store icon fails ([3f85494](https://github.com/AsoBeast/asobeast/commit/3f8549448c0e815fffd09da0e6b801e2a5be8cdc))
* **web:** fall back to the letter placeholder when an icon fails ([377a7d5](https://github.com/AsoBeast/asobeast/commit/377a7d51b0b97bdecb118f940c6d982d16645407))
* **web:** keep the app icon decorative whether it loads or not ([dd595b8](https://github.com/AsoBeast/asobeast/commit/dd595b84eb18842ad52ba74c4b26ea3cea173abb))
* **web:** offer the recovery a held subscription needs ([be2e369](https://github.com/AsoBeast/asobeast/commit/be2e36903646245bf320768c29b479a55416a039))
* **web:** read the dashboard action summary as the page prefetches it ([5f860db](https://github.com/AsoBeast/asobeast/commit/5f860dba96e728d621963aa911f9ead98912aabc))
* **web:** read the ratings histogram as its page prefetches it ([2004584](https://github.com/AsoBeast/asobeast/commit/2004584c349fa41c72255999296985fae240e5ce))
* **web:** render relative times from one instant ([55fefbd](https://github.com/AsoBeast/asobeast/commit/55fefbd3442eaee9126c996facf8e59ca522b2f9))
* **web:** render the dashboard and its relative times from one server state ([44b8991](https://github.com/AsoBeast/asobeast/commit/44b89919ba9e29b3dd614882b2eaebcee9d54e90))
* **web:** retry an icon whose url comes back after a failure ([3f44e3c](https://github.com/AsoBeast/asobeast/commit/3f44e3cd94e3edbca8ba01fa0ab15a467e649c76))
* **web:** state the password rule beside the password field ([4ecabcc](https://github.com/AsoBeast/asobeast/commit/4ecabcc42bd914e17e9195bbfd6110415f12bc9e))


### Performance

* **keywords:** leave inactive phrases alone when a keyword field save deactivates ([83eadc5](https://github.com/AsoBeast/asobeast/commit/83eadc5a7e0a7b5e5fae754b33e6ab407831f4d8))


### Refactoring

* **api:** give a subscription status one table and three outcomes ([01319e4](https://github.com/AsoBeast/asobeast/commit/01319e4905688ca86a33c19c343ad8737f091586))
* **api:** pick a held subscription by one rule ([9dc36e7](https://github.com/AsoBeast/asobeast/commit/9dc36e7c6312e809656a6b41095871b83b5fe84b))
* **api:** write a workspace from one subscription projection ([68bc73d](https://github.com/AsoBeast/asobeast/commit/68bc73d604cc3ecfa8d2170491e2855b92d116df))
* **shared:** keep the score display maximum private ([5c99263](https://github.com/AsoBeast/asobeast/commit/5c9926309ab6bab04529dc510e56f918811c841e))
* **shared:** share the password rule predicate with the web app ([6c24708](https://github.com/AsoBeast/asobeast/commit/6c247085872ee164e951024c31229885f0a86b37))
* **web:** move the comparison matrix score label into its own module ([0b9ad37](https://github.com/AsoBeast/asobeast/commit/0b9ad37ec891aac778bc8efa52d9a2f783a44d17))
* **web:** share the route cookie seeding between specs ([b27d717](https://github.com/AsoBeast/asobeast/commit/b27d71707d27efde25129820db76d3062a280815))


### Documentation

* **api:** document the not found answer on the app action route ([071c166](https://github.com/AsoBeast/asobeast/commit/071c1669a799b7b16d4d0b512c04b18392003ffb))
* **docs:** correct the stored scale for difficulty ([902cde8](https://github.com/AsoBeast/asobeast/commit/902cde8feeb65341d8d69591fba0f6e94bf3a5be))
* **docs:** list the normalized keyword field limit ([ed98198](https://github.com/AsoBeast/asobeast/commit/ed98198ec4ef95ce87fe481599f66ff1813ce74b))
* **docs:** record how a stalled subscription recovers ([12f5fb8](https://github.com/AsoBeast/asobeast/commit/12f5fb84053f8d542a29a8305d185bfd530867c6))
* **docs:** record the password rule and what it does not change ([656008b](https://github.com/AsoBeast/asobeast/commit/656008be265e01fda8df1920ee4b76a58453fc40))
* **docs:** say the keyword field keeps the order of the latest save ([0c7ed15](https://github.com/AsoBeast/asobeast/commit/0c7ed15b3dd904b6e27f419348ad4e79e9418166))
* **docs:** scope the uniform sign in answer to the length limit ([53df47d](https://github.com/AsoBeast/asobeast/commit/53df47d4c42df26c80e861ba2b3d884814b09558))
* **docs:** state that the last keyword field save wins ([14d1d7a](https://github.com/AsoBeast/asobeast/commit/14d1d7acedde5806a6f3326bd5afe574360b9dad))
* **docs:** state the keyword field limit on the stores concept page ([d40ee44](https://github.com/AsoBeast/asobeast/commit/d40ee44f2e417e8ce0ba4a47855016a395f7b764))
* **docs:** state the scale of scores in action evidence ([2f1d0b1](https://github.com/AsoBeast/asobeast/commit/2f1d0b1d097c271c81cc7b232646681dbaa432d0))
* **docs:** state which keywords a keyword field save may untrack ([6b55794](https://github.com/AsoBeast/asobeast/commit/6b55794b31bca022cb21f29ba8d6608a33426920))
* **keywords:** describe the keyword field save in the api reference ([3c4ece0](https://github.com/AsoBeast/asobeast/commit/3c4ece0ba8ab5378e30d182e13d1d63cb040d2c1))
* **keywords:** state the keyword field read order in the api reference ([c4e6a51](https://github.com/AsoBeast/asobeast/commit/c4e6a51a85d4cf852b46d7639c4c2c049f1c7342))
* **mcp:** match the list_keywords scale wording to the tools page ([120bb96](https://github.com/AsoBeast/asobeast/commit/120bb964f2418d228fe059f90c2ab9d8c420cba6))
* **mcp:** state the scale of each score in the list_keywords tool ([c5b1483](https://github.com/AsoBeast/asobeast/commit/c5b148303694f50b0f4fd744f15914572e67eb09))
* **repo:** record the toolchain move and the holds it leaves ([2aca297](https://github.com/AsoBeast/asobeast/commit/2aca2972bdd198a14192d4394d55c14ffd33786c))
* **repo:** say what a blocked install script means ([c65b34b](https://github.com/AsoBeast/asobeast/commit/c65b34b52a49a35d1f243ea38e4753c32f525aa2))
* **web:** tell the keyword field editor keeps a repeated phrase once ([66cb0ae](https://github.com/AsoBeast/asobeast/commit/66cb0ae727b518ce07aa48933b7b2c45b64621d1))
* **web:** tell the keyword field editor keeps the pasted order ([f020b0a](https://github.com/AsoBeast/asobeast/commit/f020b0a4cda215fbd6f82ecd16f0f76f64d7aff6))


### Build and Deployment

* **docs:** run mint through npx ([e48b2b6](https://github.com/AsoBeast/asobeast/commit/e48b2b611635a8095c0ef3dbfa1e7be6cdd678eb))
* **repo:** install node for the sandbox architecture ([4a6252f](https://github.com/AsoBeast/asobeast/commit/4a6252f0eb2187fc1648203fe97695872a7197dc))
* **repo:** move the workspace to pnpm 12 ([e99f30d](https://github.com/AsoBeast/asobeast/commit/e99f30d621aafb393c6f2be9ef463823b36bad87))
* **repo:** run the stack in claude code cloud sessions ([3197dcb](https://github.com/AsoBeast/asobeast/commit/3197dcb74aeb414b0afba00f7f74d84f190cb1dc))
* **repo:** run the stack in claude code cloud sessions ([eeb3838](https://github.com/AsoBeast/asobeast/commit/eeb38380b1cf411ba5b3dc5b4a8a4f56fb7041ac))

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
