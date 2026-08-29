-- Server-side preview document cache for the inline preview (ADR-0007).
-- Global rows keyed by (kind, normalized url hash); service-role only (no RLS
-- policies: anon/authenticated roles see zero rows). kind distinguishes
-- reader-extracted articles ('extract', TTL 24h) from native-render proxy
-- documents ('proxy', TTL 1h) so the two lifecycles never share rows.
-- See lib/preview, lib/extract, and docs/adr/0007-inline-preview.md.

CREATE TABLE "bookmark_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_hash" text NOT NULL,
	"kind" text NOT NULL DEFAULT 'extract',
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
-- Row identity is (kind, url): the same URL can hold both an article
-- extraction and a proxy document without clobbering each other.
CREATE UNIQUE INDEX "bookmark_extractions_kind_url_hash_key" ON "bookmark_extractions" USING btree ("kind", "url_hash");
--> statement-breakpoint
CREATE INDEX "idx_bookmark_extractions_fetched_at" ON "bookmark_extractions" USING btree ("fetched_at");
--> statement-breakpoint
ALTER TABLE public.bookmark_extractions ENABLE ROW LEVEL SECURITY;

-- No RLS policies on purpose: this table is service-role-only.
