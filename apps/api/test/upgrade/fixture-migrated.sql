BEGIN;

UPDATE "TrackedKeyword"
SET "fieldOrder" = 0
WHERE "appId" = 'app_ios'
  AND "keywordId" = 'kw_ios_us';

UPDATE "AppSnapshot"
SET "summary" = 'Workouts & meals ''daily'', amp tools, R&D &lt;3, ''fit'''
WHERE "id" = 'snap_play_escaped';

UPDATE "TrackedKeyword"
SET "active" = false
WHERE ("appId", "keywordId") IN (('app_play', 'kw_play_amp_meals'), ('app_play', 'kw_play_39_daily'));

COMMIT;
