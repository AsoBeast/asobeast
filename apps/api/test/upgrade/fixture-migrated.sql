BEGIN;

UPDATE "TrackedKeyword"
SET "fieldOrder" = 0
WHERE "appId" = 'app_ios'
  AND "keywordId" = 'kw_ios_us';

UPDATE "App"
SET "storeAppId" = '333333333'
WHERE "id" = 'app_padded';

UPDATE "TrackedKeyword"
SET "active" = false
WHERE ("appId", "keywordId") IN (('app_ios', 'kw_ios_zz'), ('app_play', 'kw_play_pw'));

COMMIT;
