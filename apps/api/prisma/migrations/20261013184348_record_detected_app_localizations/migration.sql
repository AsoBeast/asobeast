INSERT INTO "AppLocalization" ("appId", "workspaceId", "localization", "origin", "createdAt")
SELECT s."appId", a."workspaceId", s."localization", 'detected', MIN(s."capturedAt")
FROM "AppSnapshot" s
JOIN "App" a ON a."id" = s."appId"
WHERE s."localization" IS NOT NULL
  AND a."store" = 'APP_STORE'
  AND a."isCompetitor" = false
GROUP BY s."appId", a."workspaceId", s."localization"
ON CONFLICT DO NOTHING;
