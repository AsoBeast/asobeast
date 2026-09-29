INSERT INTO "ActionEvent" ("id", "workspaceId", "actionId", "appId", "type", "actor", "status", "priority", "impact", "snoozedUntil", "occurredAt")
SELECT 'bf_' || i."id" || '_s', i."workspaceId", i."id", i."appId", 'snoozed', 'user', 'SNOOZED', i."priority", i."impact", i."snoozedUntil",
       GREATEST(i."updatedAt", latest."occurredAt" + INTERVAL '1 millisecond')
FROM "ActionItem" AS i
JOIN LATERAL (
  SELECT e."type", e."occurredAt"
  FROM "ActionEvent" AS e
  WHERE e."actionId" = i."id"
  ORDER BY e."occurredAt" DESC, e."id" DESC
  LIMIT 1
) AS latest ON TRUE
WHERE i."status" = 'SNOOZED' AND i."snoozedUntil" IS NOT NULL AND latest."type" <> 'snoozed';
