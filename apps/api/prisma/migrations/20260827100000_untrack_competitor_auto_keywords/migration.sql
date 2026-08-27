DELETE FROM "TrackedKeyword"
USING "App"
WHERE "App"."id" = "TrackedKeyword"."appId"
  AND "App"."isCompetitor" = true
  AND "TrackedKeyword"."source" IN ('TITLE', 'SUBTITLE', 'DESCRIPTION');
