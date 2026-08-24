ALTER FUNCTION app_current_workspace() SET search_path = pg_catalog;

ALTER FUNCTION app_tenancy_bypassed() SET search_path = pg_catalog;

ALTER FUNCTION app_enter_workspace(text) SET search_path = pg_catalog;

ALTER FUNCTION app_enter_cross_tenant() SET search_path = pg_catalog;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
