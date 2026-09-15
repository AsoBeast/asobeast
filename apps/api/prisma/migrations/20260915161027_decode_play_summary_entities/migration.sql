UPDATE "AppSnapshot" AS "snapshot"
SET "summary" = replace(
  replace(
    replace(
      replace(
        replace("snapshot"."summary", '&lt;', '<'),
        '&gt;', '>'),
      '&quot;', '"'),
    '&#39;', ''''),
  '&amp;', '&')
FROM "App"
WHERE "App"."id" = "snapshot"."appId"
  AND "App"."store" = 'GOOGLE_PLAY'
  AND "snapshot"."summary" ~ '&(amp|lt|gt|quot|#39);';
