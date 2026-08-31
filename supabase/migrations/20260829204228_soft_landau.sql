CREATE TABLE "cloud_connections" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_email" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"last_backup_at" timestamp with time zone,
	"last_backup_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cloud_connections_provider_check" CHECK (provider IN ('google_drive', 'dropbox', 'onedrive')),
	CONSTRAINT "cloud_connections_last_backup_status_check" CHECK (last_backup_status IN ('success', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "cloud_connections" ADD CONSTRAINT "cloud_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cloud_connections_user_id" ON "cloud_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cloud_connections_user_provider_key" ON "cloud_connections" USING btree ("user_id","provider");--> statement-breakpoint
-- RLS: rows hold provider OAuth tokens, so only the owner may read or write
-- them (same posture as profiles). Drizzle paths enforce user_id explicitly
-- because the service-role connection bypasses RLS.
ALTER TABLE "cloud_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "Users can view their own cloud connections" ON "cloud_connections"
  FOR SELECT USING (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "Users can insert their own cloud connections" ON "cloud_connections"
  FOR INSERT WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "Users can update their own cloud connections" ON "cloud_connections"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "Users can delete their own cloud connections" ON "cloud_connections"
  FOR DELETE USING (auth.uid() = user_id);