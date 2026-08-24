BEGIN;

INSERT INTO "Workspace" ("id", "name", "createdAt")
VALUES ('ws_default', 'Default', '2026-07-01 00:00:00');

INSERT INTO "User" ("id", "workspaceId", "email", "passwordHash", "name", "role", "plan", "sessionVersion", "createdAt", "updatedAt")
VALUES ('usr_owner', 'ws_default', 'owner@asobeast.test', '$argon2id$v=19$m=65536,p=4,t=3$2IvW/k4zrYISwGU8gtJ1mg$uX4IjxOXBQ/mFJ00RvtEsTYYZqtWQcjrIgcumQ3vq3I', 'Drill Owner', 'owner', 'free', 0, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO "Workspace" ("id", "name", "createdAt")
VALUES ('ws_paid', 'Paid', '2026-07-01 00:00:00');

INSERT INTO "User" ("id", "workspaceId", "email", "passwordHash", "name", "role", "plan", "planExpiresAt", "billingCustomerId", "sessionVersion", "createdAt", "updatedAt")
VALUES ('usr_paid', 'ws_paid', 'paid@asobeast.test', '$argon2id$v=19$m=65536,p=4,t=3$2IvW/k4zrYISwGU8gtJ1mg$uX4IjxOXBQ/mFJ00RvtEsTYYZqtWQcjrIgcumQ3vq3I', 'Drill Payer', 'owner', 'premium', NULL, 'cus_drill', 0, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO "ApiToken" ("id", "userId", "name", "tokenHash", "prefix", "createdAt")
VALUES ('tok_drill', 'usr_owner', 'drill', 'c17c674b21ca3368525ec4a1333a69e16352b4503055b96d530ead5523b5a175', 'asob_0123456', '2026-07-01 00:00:00');

INSERT INTO "AppGroup" ("id", "workspaceId", "name", "createdAt")
VALUES ('grp_fitness', 'ws_default', 'Fitness', '2026-07-01 00:00:00');

INSERT INTO "App" ("id", "workspaceId", "store", "storeAppId", "country", "name", "iconUrl", "isCompetitor", "primaryAppId", "groupId", "createdAt")
VALUES
  ('app_ios', 'ws_default', 'APP_STORE', '111111111', 'us', 'Drill Fitness', 'https://cdn.test/ios.png', false, NULL, 'grp_fitness', '2026-07-01 00:00:00'),
  ('app_play', 'ws_default', 'GOOGLE_PLAY', 'com.drill.fitness', 'us', 'Drill Fitness', 'https://cdn.test/play.png', false, NULL, 'grp_fitness', '2026-07-01 00:00:00'),
  ('app_rival', 'ws_default', 'APP_STORE', '222222222', 'us', 'Rival Fitness', NULL, true, 'app_ios', NULL, '2026-07-01 00:00:00');

INSERT INTO "AppSnapshot" ("id", "appId", "title", "subtitle", "summary", "description", "ratingAvg", "ratingCount", "installs", "price", "version", "releasedAt", "storeUpdatedAt", "raw", "capturedAt")
VALUES
  ('snap_ios_old', 'app_ios', 'Drill Fitness', 'Track every workout', NULL, 'Old description.', 4.5, 1200, NULL, 0, '1.0.0', '2026-01-01 00:00:00', '2026-06-01 00:00:00', '{"trackId":111111111}', '2026-07-01 00:00:00'),
  ('snap_ios_new', 'app_ios', 'Drill Fitness', 'Track every workout', NULL, 'New description.', 4.6, 1300, NULL, 0, '1.1.0', '2026-01-01 00:00:00', '2026-07-10 00:00:00', '{"trackId":111111111}', '2026-07-15 00:00:00'),
  ('snap_play', 'app_play', 'Drill Fitness', NULL, 'Track every workout in one place', 'Play description.', 4.4, 900, 500000, 0, '1.1.0', '2026-01-01 00:00:00', '2026-07-10 00:00:00', '{"appId":"com.drill.fitness"}', '2026-07-15 00:00:00');

INSERT INTO "Keyword" ("id", "text", "store", "country", "createdAt")
VALUES
  ('kw_ios_us', 'workout tracker', 'APP_STORE', 'us', '2026-07-01 00:00:00'),
  ('kw_ios_gb', 'workout tracker', 'APP_STORE', 'gb', '2026-07-01 00:00:00'),
  ('kw_ios_us_alt', 'gym log', 'APP_STORE', 'us', '2026-07-01 00:00:00'),
  ('kw_play_us', 'workout tracker', 'GOOGLE_PLAY', 'us', '2026-07-01 00:00:00');

INSERT INTO "TrackedKeyword" ("appId", "keywordId", "source", "active", "relevance", "createdAt")
VALUES
  ('app_ios', 'kw_ios_us', 'KEYWORD_FIELD', true, 90, '2026-07-01 00:00:00'),
  ('app_ios', 'kw_ios_gb', 'MANUAL', true, 80, '2026-07-01 00:00:00'),
  ('app_ios', 'kw_ios_us_alt', 'SUGGESTED', false, 40, '2026-07-01 00:00:00'),
  ('app_play', 'kw_play_us', 'DESCRIPTION', true, 70, '2026-07-01 00:00:00'),
  ('app_rival', 'kw_ios_us', 'COMPETITOR', true, NULL, '2026-07-01 00:00:00');

INSERT INTO "KeywordMetric" ("keywordId", "date", "traffic", "difficulty", "stats", "scoringSource", "formulaVersion", "confidence", "capturedAt", "createdAt")
VALUES
  ('kw_ios_us', '2026-07-01', 62, 48, NULL, NULL, NULL, NULL, NULL, '2026-07-01 00:00:00'),
  ('kw_ios_gb', '2026-07-01', 41, 35, NULL, NULL, NULL, NULL, NULL, '2026-07-01 00:00:00'),
  ('kw_play_us', '2026-07-01', 55, 52, NULL, NULL, NULL, NULL, NULL, '2026-07-01 00:00:00');

INSERT INTO "KeywordRanking" ("appId", "keywordId", "date", "position", "depth", "createdAt")
VALUES
  ('app_ios', 'kw_ios_us', '2026-07-14', 12, 200, '2026-07-14 03:00:00'),
  ('app_ios', 'kw_ios_us', '2026-07-15', 9, 200, '2026-07-15 03:00:00'),
  ('app_ios', 'kw_ios_gb', '2026-07-15', NULL, 200, '2026-07-15 03:00:00'),
  ('app_ios', 'kw_ios_us_alt', '2026-07-15', NULL, 100, '2026-07-15 03:00:00'),
  ('app_rival', 'kw_ios_us', '2026-07-15', 3, 200, '2026-07-15 03:00:00'),
  ('app_play', 'kw_play_us', '2026-07-15', 27, 200, '2026-07-15 03:00:00');

INSERT INTO "CategoryRank" ("appId", "date", "collection", "genre", "position", "depth", "createdAt")
VALUES
  ('app_ios', '2026-07-15', 'free', 'overall', 143, 200, '2026-07-15 03:00:00'),
  ('app_ios', '2026-07-15', 'grossing', '6013', NULL, 200, '2026-07-15 03:00:00'),
  ('app_play', '2026-07-15', 'free', 'overall', 88, 200, '2026-07-15 03:00:00');

INSERT INTO "SerpEntry" ("keywordId", "date", "position", "storeAppId", "title", "developer", "ratingAvg", "ratingCount", "createdAt")
VALUES
  ('kw_ios_us', '2026-07-15', 1, '333333333', 'Top Fitness', 'Top Labs', 4.8, 90000, '2026-07-15 03:00:00'),
  ('kw_ios_us', '2026-07-15', 3, '222222222', 'Rival Fitness', 'Rival Labs', 4.7, 45000, '2026-07-15 03:00:00'),
  ('kw_ios_gb', '2026-07-15', 1, '444444444', 'UK Fitness', 'UK Labs', 4.6, 12000, '2026-07-15 03:00:00');

INSERT INTO "ChangeEvent" ("id", "appId", "field", "before", "after", "capturedAt")
VALUES
  ('chg_ios_desc', 'app_ios', 'description', 'Old description.', 'New description.', '2026-07-15 03:00:00'),
  ('chg_rival_title', 'app_rival', 'title', 'Rival', 'Rival Fitness', '2026-07-15 03:00:00');

INSERT INTO "Review" ("id", "appId", "reviewId", "userName", "score", "title", "text", "version", "reviewedAt", "createdAt")
VALUES
  ('rev_ios_1', 'app_ios', 'r-1', 'runner', 5, 'Great', 'Tracks everything I need.', '1.1.0', '2026-07-14 00:00:00', '2026-07-15 03:00:00'),
  ('rev_ios_2', 'app_ios', 'r-2', 'lifter', 2, 'Crashes', 'Crashes when I sync.', '1.1.0', '2026-07-14 00:00:00', '2026-07-15 03:00:00'),
  ('rev_play_1', 'app_play', 'r-3', 'walker', 4, 'Solid', 'Works well on Android.', '1.1.0', '2026-07-14 00:00:00', '2026-07-15 03:00:00');

INSERT INTO "SuggestProbe" ("appId", "term", "day", "probe", "results", "createdAt")
VALUES ('app_ios', 'workout', '2026-07-15', 'wo', '["workout tracker","workout log"]', '2026-07-15 03:00:00');

INSERT INTO "AuditInsight" ("appId", "model", "checks", "generatedAt", "updatedAt")
VALUES ('app_ios', 'gpt-4o', '{"title":{"verdict":"pass"}}', '2026-07-15 06:00:00', '2026-07-15 06:00:00');

INSERT INTO "AuditScore" ("appId", "date", "overall", "coveredWeight", "totalWeight", "factors", "createdAt")
VALUES
  ('app_ios', '2026-07-15', 78.5, 32, 40, '{"title":8}', '2026-07-15 06:00:00'),
  ('app_play', '2026-07-15', 64, 24, 40, '{"title":6}', '2026-07-15 06:00:00');

INSERT INTO "Webhook" ("id", "workspaceId", "url", "events", "secret", "active", "createdAt")
VALUES ('wh_ops', 'ws_default', 'https://hooks.test/asobeast', ARRAY['rank.drop','review.negative'], 'whsec_drill', true, '2026-07-01 00:00:00');

INSERT INTO "EmailAlert" ("id", "workspaceId", "email", "events", "active", "createdAt")
VALUES ('mail_ops', 'ws_default', 'alerts@asobeast.test', ARRAY['rank.drop'], true, '2026-07-01 00:00:00');

INSERT INTO "AlertDelivery" ("id", "channel", "webhookId", "emailAlertId", "event", "status", "detail", "attempt", "createdAt")
VALUES
  ('del_wh_ok', 'webhook', 'wh_ops', NULL, 'rank.drop', 'sent', NULL, 1, '2026-07-15 04:00:00'),
  ('del_mail_fail', 'email', NULL, 'mail_ops', 'rank.drop', 'failed', 'smtp timeout', 2, '2026-07-15 04:00:00');

INSERT INTO "AlertEvent" ("id", "workspaceId", "event", "appId", "dedupeKey", "payload", "createdAt", "flushedAt", "flushId", "claimedAt")
VALUES
  ('evt_flushed', 'ws_default', 'rank.drop', 'app_ios', 'rank.drop:app_ios:kw_ios_us:2026-07-15', '{"positions":[9,12]}', '2026-07-15 03:30:00', '2026-07-15 04:00:00', 'flush_1', '2026-07-15 03:59:00'),
  ('evt_pending', 'ws_default', 'review.negative', 'app_ios', NULL, '{"score":2}', '2026-07-15 03:30:00', NULL, NULL, NULL),
  ('evt_pending_two', 'ws_default', 'review.negative', 'app_play', NULL, '{"score":1}', '2026-07-15 03:30:00', NULL, NULL, NULL),
  ('evt_unclaimed', 'ws_default', 'metadata.change', 'app_rival', 'metadata.change:app_rival:2026-07-15', '{"field":"title"}', '2026-07-15 03:30:00', NULL, 'flush_2', '2026-07-15 03:59:00');

COMMIT;
