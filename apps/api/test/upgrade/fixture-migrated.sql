BEGIN;

UPDATE "TrackedKeyword"
SET "fieldOrder" = 0
WHERE "appId" = 'app_ios'
  AND "keywordId" = 'kw_ios_us';

COMMIT;
