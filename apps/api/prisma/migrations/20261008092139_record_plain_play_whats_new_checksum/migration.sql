DO $$
BEGIN
  IF to_regclass('_prisma_migrations') IS NOT NULL THEN
    UPDATE "_prisma_migrations"
    SET "checksum" = 'ef76309db32b198b929768a1448ff39add7eb41aecb9bb8c3729e91220b4b824'
    WHERE "migration_name" = '20261006123544_plain_play_whats_new_events'
      AND "checksum" = 'a1aa73b64d3f87af0c3e11a822ab2909a287a7d1253eb87600b8a54238697ce7';
  END IF;
END;
$$;
