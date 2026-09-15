BEGIN;

UPDATE "TrackedKeyword"
SET "fieldOrder" = 0
WHERE "appId" = 'app_ios'
  AND "keywordId" = 'kw_ios_us';

UPDATE "App"
SET "storeAppId" = CASE "id"
  WHEN 'app_padded' THEN '333333333'
  WHEN 'app_padded_pair_a' THEN '444444444'
END
WHERE "id" IN ('app_padded', 'app_padded_pair_a');

UPDATE "TrackedKeyword"
SET "active" = false
WHERE ("appId", "keywordId") IN (('app_ios', 'kw_ios_zz'), ('app_play', 'kw_play_pw'));

COMMIT;
