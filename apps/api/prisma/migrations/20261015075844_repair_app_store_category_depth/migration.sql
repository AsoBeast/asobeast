UPDATE "CategoryRank" r
SET "depth" = 100
FROM "App" a
WHERE a."id" = r."appId" AND a."store" = 'APP_STORE' AND r."depth" = 200;
