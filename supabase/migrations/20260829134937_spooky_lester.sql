CREATE TABLE "bookmark_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_hash" text NOT NULL,
	"kind" text DEFAULT 'extract' NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"byline" text,
	"site_name" text,
	"excerpt" text,
	"html" text,
	"length" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmark_extractions_status_check" CHECK (status IN ('ok', 'empty')),
	CONSTRAINT "bookmark_extractions_kind_check" CHECK (kind IN ('extract', 'proxy'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bookmark_extractions_kind_url_hash_key" ON "bookmark_extractions" USING btree ("kind","url_hash");
--> statement-breakpoint
CREATE INDEX "idx_bookmark_extractions_fetched_at" ON "bookmark_extractions" USING btree ("fetched_at");
--> statement-breakpoint
-- Global rows keyed by (kind, url hash); service-role only: RLS enabled with
-- zero policies so anon/authenticated roles see no rows. kind separates
-- reader extractions ('extract', TTL 24h) from proxy documents ('proxy',
-- TTL 1h). See lib/preview and docs/adr/0007-inline-preview.md.
ALTER TABLE public.bookmark_extractions ENABLE ROW LEVEL SECURITY;
