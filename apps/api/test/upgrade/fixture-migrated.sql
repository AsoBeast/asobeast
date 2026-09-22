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

UPDATE "AppSnapshot"
SET "summary" = 'Workouts & meals ''daily'', amp tools, R&D &lt;3, ''fit'''
WHERE "id" = 'snap_play_escaped';

UPDATE "AppSnapshot"
SET "summary" = 'Yoga & stretch, amp pilates'
WHERE "id" = 'snap_play_old_escaped';

UPDATE "TrackedKeyword"
SET "active" = false
WHERE ("appId", "keywordId") IN (('app_play', 'kw_play_amp_meals'), ('app_play', 'kw_play_39_daily'), ('app_play', 'kw_play_amp_stretch'));

UPDATE "BillingEvent"
SET "outcome" = 'applied'
WHERE "id" = 'evt_drill_applied';

UPDATE "BillingEvent"
SET "outcome" = 'orphaned', "processedAt" = "receivedAt", "failure" = NULL
WHERE "id" IN ('evt_drill_orphan', 'evt_drill_foreign');

COMMIT;
