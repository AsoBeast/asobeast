CREATE FUNCTION pg_temp.release_notes_entity(body text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  hex boolean := lower(left(body, 2)) = '#x';
  digits text;
  code integer;
BEGIN
  IF left(body, 1) <> '#' THEN
    RETURN CASE lower(body)
      WHEN 'amp' THEN '&'
      WHEN 'lt' THEN '<'
      WHEN 'gt' THEN '>'
      WHEN 'quot' THEN '"'
      WHEN 'apos' THEN ''''
      WHEN 'nbsp' THEN ' '
    END;
  END IF;
  digits := ltrim(substr(body, CASE WHEN hex THEN 3 ELSE 2 END), '0');
  IF digits = '' OR length(digits) > 7 THEN
    RETURN NULL;
  END IF;
  code := CASE
    WHEN hex THEN ('x' || lpad(digits, 8, '0'))::bit(32)::integer
    ELSE digits::integer
  END;
  IF code > 1114111 OR code BETWEEN 55296 AND 57343 THEN
    RETURN NULL;
  END IF;
  RETURN chr(code);
END;
$$;

CREATE FUNCTION pg_temp.release_notes_text(notes text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  entity_pattern constant text := '&(#x[0-9a-f]+|#[0-9]+|[a-z]+);';
  whitespace constant text := E' \t\u000B\f\r ﻿              　  ';
  text_only text := regexp_replace(notes, '<br\M[^>]*>|\r\n?', E'\n', 'gi');
  previous text;
  rest text;
  decoded text := '';
  entity text;
  position integer;
BEGIN
  LOOP
    previous := text_only;
    text_only := regexp_replace(text_only, '</?[a-z][^>]*>', '', 'gi');
    EXIT WHEN text_only = previous;
  END LOOP;
  text_only := regexp_replace(text_only, '</?[a-z][^<>]*…$', '…', 'i');
  text_only := regexp_replace(text_only, '</?[a-z][^<>]*$', '', 'i');

  rest := text_only;
  LOOP
    position := regexp_instr(rest, entity_pattern, 1, 1, 0, 'i');
    EXIT WHEN position = 0;
    entity := regexp_substr(rest, entity_pattern, 1, 1, 'i');
    decoded := decoded
      || left(rest, position - 1)
      || coalesce(
        pg_temp.release_notes_entity(substr(entity, 2, length(entity) - 2)),
        entity
      );
    rest := substr(rest, position + length(entity));
  END LOOP;
  decoded := decoded || rest;

  RETURN NULLIF(
    array_to_string(
      ARRAY(
        SELECT btrim(line, whitespace)
        FROM unnest(string_to_array(decoded, E'\n')) WITH ORDINALITY AS lines(line, ordinal)
        WHERE btrim(line, whitespace) <> ''
        ORDER BY ordinal
      ),
      E'\n'
    ),
    ''
  );
END;
$$;

UPDATE "ChangeEvent" AS "event"
SET "before" = pg_temp.release_notes_text("event"."before"),
    "after" = pg_temp.release_notes_text("event"."after")
FROM "App"
WHERE "App"."id" = "event"."appId"
  AND "App"."store" = 'GOOGLE_PLAY'
  AND "event"."field" = 'whatsNew'
  AND "event"."capturedAt" < (
    SELECT max("finished_at") AT TIME ZONE 'UTC'
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20260929080231_backfill_snoozed_action_events'
      AND "rolled_back_at" IS NULL
  );

DELETE FROM "ChangeEvent" AS "event"
USING "App"
WHERE "App"."id" = "event"."appId"
  AND "App"."store" = 'GOOGLE_PLAY'
  AND "event"."field" = 'whatsNew'
  AND "event"."before" IS NOT DISTINCT FROM "event"."after";

DROP FUNCTION pg_temp.release_notes_text(text);
DROP FUNCTION pg_temp.release_notes_entity(text);
