INSERT INTO "AppLocalization" ("appId", "workspaceId", "localization", "origin")
SELECT DISTINCT s."appId", a."workspaceId", s."localization", 'detected'
FROM "AppSnapshot" s
JOIN "App" a ON a."id" = s."appId"
WHERE s."localization" IS NOT NULL
  AND a."store" = 'APP_STORE'
  AND a."isCompetitor" = false
ON CONFLICT DO NOTHING;
