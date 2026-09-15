UPDATE "TrackedKeyword" AS "tracked"
SET "active" = false
FROM "Keyword" AS "keyword"
WHERE "keyword"."id" = "tracked"."keywordId"
  AND "tracked"."active" = true
  AND (
    ("keyword"."store" = 'APP_STORE' AND "keyword"."country" NOT IN (
      'ae', 'af', 'ag', 'ai', 'al', 'am', 'ao', 'ar', 'at', 'au', 'az', 'ba', 'bb', 'be', 'bf', 'bg',
      'bh', 'bj', 'bm', 'bn', 'bo', 'br', 'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cd', 'cg', 'ch', 'ci',
      'cl', 'cm', 'cn', 'co', 'cr', 'cv', 'cy', 'cz', 'de', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg',
      'es', 'fi', 'fj', 'fm', 'fr', 'ga', 'gb', 'gd', 'ge', 'gh', 'gm', 'gr', 'gt', 'gw', 'gy', 'hk',
      'hn', 'hr', 'hu', 'id', 'ie', 'il', 'in', 'iq', 'is', 'it', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh',
      'kn', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'lk', 'lr', 'lt', 'lu', 'lv', 'ly', 'ma', 'md',
      'me', 'mg', 'mk', 'ml', 'mm', 'mn', 'mo', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz',
      'na', 'ne', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nz', 'om', 'pa', 'pe', 'pg', 'ph', 'pk', 'pl',
      'pt', 'pw', 'py', 'qa', 'ro', 'rs', 'ru', 'rw', 'sa', 'sb', 'sc', 'se', 'sg', 'si', 'sk', 'sl',
      'sn', 'sr', 'st', 'sv', 'sz', 'tc', 'td', 'th', 'tj', 'tm', 'tn', 'to', 'tr', 'tt', 'tw', 'tz',
      'ua', 'ug', 'us', 'uy', 'uz', 'vc', 've', 'vg', 'vn', 'vu', 'xk', 'ye', 'za', 'zm', 'zw'
    ))
    OR ("keyword"."store" = 'GOOGLE_PLAY' AND "keyword"."country" NOT IN (
      'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'ao', 'aq', 'ar', 'at', 'au', 'aw', 'az', 'ba', 'bb',
      'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo', 'bq', 'br', 'bs', 'bt', 'bv', 'bw',
      'by', 'bz', 'ca', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'cr', 'cu',
      'cv', 'cw', 'cx', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'eh', 'er',
      'es', 'et', 'fi', 'fj', 'fk', 'fm', 'fr', 'ga', 'gb', 'gd', 'ge', 'gg', 'gh', 'gi', 'gm', 'gn',
      'gq', 'gr', 'gs', 'gt', 'gw', 'gy', 'hk', 'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im',
      'in', 'io', 'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'ki', 'km', 'kn',
      'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma',
      'mc', 'md', 'me', 'mg', 'mk', 'ml', 'mm', 'mn', 'mo', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx',
      'my', 'mz', 'na', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz', 'om', 'pa', 'pe',
      'pg', 'ph', 'pk', 'pl', 'pn', 'ps', 'pt', 'py', 'qa', 'ro', 'rs', 'ru', 'rw', 'sa', 'sb', 'sc',
      'sd', 'se', 'sg', 'sh', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sz', 'tc',
      'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tr', 'tt', 'tv', 'tw', 'tz', 'ua',
      'ug', 'um', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vg', 'vn', 'vu', 'ws', 'xk', 'ye', 'za', 'zm',
      'zw'
    ))
  );
