DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'asobeast_app') THEN
    CREATE ROLE asobeast_app NOLOGIN;
  END IF;
END $$;

GRANT asobeast_app TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO asobeast_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO asobeast_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO asobeast_app;

CREATE OR REPLACE FUNCTION app_enter_workspace(workspace_id text) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM set_config('app.workspace_id', coalesce(workspace_id, ''), true);
  SET LOCAL ROLE asobeast_app;
END $$;
