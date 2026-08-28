-- Local Supabase applies restrictive default privileges to tables created by
-- the postgres role (i.e. migrations): API roles get only TRUNCATE/REFERENCES/
-- TRIGGER. Hosted projects grant full table privileges and let RLS alone
-- enforce access. Align the local posture with hosted: grant table-level
-- privileges to the API roles; RLS remains the enforcement layer
-- (audit_events stays sealed — RLS enabled, no policies).
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
--> statement-breakpoint
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
