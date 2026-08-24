import type { User } from "@supabase/supabase-js";
import type { ZodType } from "zod";

import { NextResponse } from "next/server";

import { createClient } from "~/lib/supabase/server";
import { logger } from "~/lib/utils/logger";

interface ExtensionConfig<TBody> {
  scope: string;
  /** JSON body schema; when set, the payload is parsed and validated before the handler runs. */
  bodySchema?: ZodType<TBody>;
  /** Response for auth failures. Default: 401 {"error":"Unauthorized"}. */
  unauthorized?: () => Response;
  /** Message for unexpected handler errors. Default derived from scope. */
  failureMessage?: string;
  /**
   * Replace the default 500 response when the handler throws. Routes whose
   * consumers degrade gracefully (e.g. "already saved?" checks) use this to
   * keep their contract on any failure.
   */
  onUnexpected?: () => Response;
}

interface ExtensionContext<TBody> {
  req: Request;
  user: User;
  body: TBody;
}

type SupabaseFactory = () => Promise<{
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
}>;

/**
 * Shared pipeline for extension API routes: body validation, authentication,
 * and normalized error responses. Handlers contain business logic only and
 * throw on infrastructure failures.
 *
 * HTTP {"error": string} is a deliberate vocabulary here, separate from
 * ActionResult — extension consumers never see server-side failure shapes.
 */
export function withExtension<TBody = undefined>(
  config: ExtensionConfig<TBody>,
  handler: (ctx: ExtensionContext<TBody>) => Promise<Response>,
  supabaseFactory: SupabaseFactory = createClient,
) {
  return async (req: Request): Promise<Response> => {
    try {
      // SAFETY: assigned from parsed.data below when bodySchema is set.
      let body = undefined as TBody;
      if (config.bodySchema) {
        const json = await req.json().catch(() => null);
        const parsed = config.bodySchema.safeParse(json);
        if (!parsed.success) {
          // Schema issue text stays in logs; clients get a generic
          // validation message.
          logger.warn(`${config.scope} rejected payload`, {
            error: parsed.error,
          });
          return NextResponse.json(
            { error: "Invalid request" },
            { status: 400 },
          );
        }
        body = parsed.data;
      }

      const supabase = await supabaseFactory();
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data?.user) {
        return config.unauthorized
          ? config.unauthorized()
          : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // SAFETY: Supabase returns the full auth user on this path; the
      // factory contract only narrows to `id`.
      return await handler({ req, user: data.user as User, body });
    } catch (cause) {
      logger.error(`${config.scope} failed`, { error: cause });
      if (config.onUnexpected) return config.onUnexpected();
      return NextResponse.json(
        { error: config.failureMessage ?? `${config.scope} failed` },
        { status: 500 },
      );
    }
  };
}
