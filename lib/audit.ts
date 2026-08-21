import type { SupabaseClient } from "@supabase/supabase-js";

import { z } from "zod";

import type { DrizzleDb } from "~/lib/data/db-connection";

import { auditEvents } from "~/lib/data/schema";

/**
 * Audit trail for PRIVILEGED access to user data (see
 * docs/policies/data-access.md). Scope: operations that cross user boundaries
 * or bypass RLS — today, the three cron jobs. Ordinary per-user CRUD through
 * the authenticated app must NOT call this module; it is governed by auth and
 * ownership scoping, and logging it would drown the trail in noise.
 *
 * Audit rows never contain user content. Every free-form channel is
 * structurally constrained, not just key-blocklisted:
 *   - actor_id / resource_type: machine-identifier grammar (no spaces, `/`,
 *     or `@`, so no URLs, emails, or sentences can pass as identities).
 *   - metadata keys: identifier grammar plus a content-word blocklist.
 *   - metadata values: identifier/token grammar — no spaces (no sentences),
 *     no `/` (no URLs/paths), no `@` (no emails).
 *   - resource_id: UUID only (never an email or username).
 * Only `reason` may carry prose; the policy forbids user content in it.
 * The structural rules below are mirrored by CHECK constraints in
 * supabase/migrations/20260820000000_add_audit_events.sql so the same bounds
 * hold for writers that skip this module.
 */

const AUDIT_ACTOR_TYPES = ["cron", "developer", "system"] as const;

type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

// Identifier grammar for identity fields. These rules structurally exclude
// URLs (no `/`), emails (no `@`), file paths, and prose (no spaces) — and are
// mirrored by CHECK constraints in the migration so the same bounds hold for
// writers that bypass this module.
const ACTOR_ID_REGEX = /^[A-Za-z][A-Za-z0-9_:#.-]{0,199}$/;
const RESOURCE_TYPE_REGEX = /^[a-z][a-z0-9_.-]{0,99}$/;
const METADATA_KEY_REGEX = /^[A-Za-z][A-Za-z0-9_.]{0,59}$/;
const METADATA_VALUE_REGEX = /^[A-Za-z0-9_.:#-]{1,200}$/;

const metadataValueSchema = z.union([
  z
    .string()
    .regex(
      METADATA_VALUE_REGEX,
      "audit metadata strings must be identifier-like tokens, not content",
    ),
  z.number(),
  z.boolean(),
]);

const CONTENT_KEY_BLOCKLIST = [
  "url",
  "link",
  "title",
  "note",
  "content",
  "summary",
  "description",
  "body",
  "email",
  "name",
  "bio",
  "guid",
  "favicon",
  "ogimage",
  "username",
  "password",
  "token",
  "secret",
  "tag",
  "query",
  "address",
  "phone",
];

function keyLooksLikeContent(key: string): boolean {
  const lower = key.toLowerCase();
  return CONTENT_KEY_BLOCKLIST.some((blocked) => lower.includes(blocked));
}

const auditMetadataSchema = z
  .record(z.string().regex(METADATA_KEY_REGEX), metadataValueSchema)
  .refine(
    (metadata) =>
      Object.keys(metadata).every((key) => !keyLooksLikeContent(key)),
    { message: "audit metadata keys must not reference user content" },
  );

const actionSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._][a-z0-9]+)*$/, "action must be dot-namespaced");

const auditEventSchema = z.object({
  actorType: z.enum(AUDIT_ACTOR_TYPES),
  actorId: z
    .string()
    .regex(ACTOR_ID_REGEX, "actorId must be a machine identity"),
  action: actionSchema,
  resourceType: z
    .string()
    .regex(RESOURCE_TYPE_REGEX, "resourceType must be a structural type name"),
  resourceId: z.uuid().optional(),
  reason: z.string().min(3).max(500),
  metadata: auditMetadataSchema.default({}),
});

export type AuditEventInput = z.input<typeof auditEventSchema>;

interface AuditEventRow {
  actor_type: AuditActorType;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  reason: string;
  metadata: Record<string, string | number | boolean>;
}

/**
 * Validate an event and return the database row shape. Throws a ZodError for
 * anything that violates the content rules. Both transports (Drizzle below,
 * supabase-js in the legacy cron scripts) go through this one validation path.
 */
export function buildAuditEventRow(input: AuditEventInput): AuditEventRow {
  const event = auditEventSchema.parse(input);
  return {
    actor_type: event.actorType,
    actor_id: event.actorId,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId ?? null,
    reason: event.reason,
    metadata: event.metadata,
  };
}

/** Identity for a GitHub Actions cron run; falls back to "local" outside CI. */
export function cronActor(scriptName: string): string {
  return `cron:${scriptName}#${process.env.GITHUB_RUN_ID ?? "local"}`;
}

/**
 * Insert one validated audit event. Audit writes must never be silently
 * swallowed: callers must await the promise and treat failure as a failed
 * privileged run (docs/policies/data-access.md §5.4).
 */
export async function insertAuditEvent(
  db: DrizzleDb,
  input: AuditEventInput,
): Promise<void> {
  const row = buildAuditEventRow(input);
  await db.insert(auditEvents).values({
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    reason: row.reason,
    metadata: row.metadata,
  });
}

/** supabase-js transport for cron scripts that predate the Drizzle data layer. */
export async function insertAuditEventSupabase(
  supabase: SupabaseClient,
  input: AuditEventInput,
): Promise<void> {
  const row = buildAuditEventRow(input);
  const { error } = await supabase.from("audit_events").insert(row);
  if (error) {
    throw new Error(`audit insert failed: ${error.message}`);
  }
}
