UPDATE "AuditScore"
SET "factors" = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof("factor" -> 'checks') = 'array' THEN jsonb_set(
        "factor",
        '{checks}',
        coalesce(
          (
            SELECT jsonb_agg(
              CASE
                WHEN "item" ->> 'id' = 'keyword-field-bytes'
                  THEN "item" || '{"id": "keyword-field-length", "label": "Character usage"}'::jsonb
                ELSE "item"
              END
              ORDER BY "position"
            )
            FROM jsonb_array_elements("factor" -> 'checks') WITH ORDINALITY AS "entry"("item", "position")
          ),
          '[]'::jsonb
        )
      )
      ELSE "factor"
    END
    ORDER BY "index"
  )
  FROM jsonb_array_elements("AuditScore"."factors") WITH ORDINALITY AS "listed"("factor", "index")
)
WHERE jsonb_typeof("factors") = 'array'
  AND jsonb_path_exists("factors", '$[*].checks[*] ? (@.id == "keyword-field-bytes")');

UPDATE "ActionItem"
SET "evidence" = jsonb_set(
  "evidence",
  '{failingChecks}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN "item" ->> 'id' = 'keyword-field-bytes'
          THEN "item" || '{"id": "keyword-field-length", "label": "Character usage"}'::jsonb
        ELSE "item"
      END
      ORDER BY "position"
    )
    FROM jsonb_array_elements("evidence" -> 'failingChecks') WITH ORDINALITY AS "entry"("item", "position")
  )
)
WHERE "rule" = 'audit.fix_factor'
  AND jsonb_typeof("evidence" -> 'failingChecks') = 'array'
  AND jsonb_path_exists("evidence", '$.failingChecks[*] ? (@.id == "keyword-field-bytes")');
