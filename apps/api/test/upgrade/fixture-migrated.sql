BEGIN;

INSERT INTO "KeywordField" ("appId", "workspaceId", "localization", "phrases", "updatedAt")
VALUES ('app_ios', 'ws_default', 'en-US', ARRAY['workout tracker'], '2026-07-01 00:00:00')
ON CONFLICT ("appId", "localization") DO UPDATE SET "phrases" = EXCLUDED."phrases";

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

UPDATE "AppSnapshot"
SET "version" = NULL
WHERE "id" = 'snap_play_escaped';

UPDATE "BillingEvent"
SET "outcome" = 'applied'
WHERE "id" = 'evt_drill_applied';

UPDATE "BillingEvent"
SET "outcome" = 'orphaned', "processedAt" = "receivedAt", "failure" = NULL
WHERE "id" IN ('evt_drill_orphan', 'evt_drill_foreign');

UPDATE "EmailAlert"
SET "confirmedAt" = "createdAt"
WHERE "id" = 'mail_ops';

INSERT INTO "AppSetup" ("appId", "workspaceId", "status", "skipped", "countriesReviewed", "selectedMarkets", "createdAt", "updatedAt")
SELECT a."id", a."workspaceId", 'not_started', '{}', false, ARRAY[a."country"], a."createdAt", a."createdAt"
FROM "App" a
WHERE a."isCompetitor" = false
ON CONFLICT ("appId") DO NOTHING;

UPDATE "CategoryRank" r
SET "depth" = 100
FROM "App" a
WHERE a."id" = r."appId" AND a."store" = 'APP_STORE' AND r."depth" = 200;

UPDATE "Workspace"
SET "firstPaidAt" = "subscriptionEventAt"
WHERE "id" = 'ws_subscribed';

COMMIT;
