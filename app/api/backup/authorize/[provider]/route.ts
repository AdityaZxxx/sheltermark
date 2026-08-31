import { NextResponse } from "next/server";

import { requireAuthSafe } from "~/lib/auth";
import { backupAuthorizeUrl, signState } from "~/lib/backup/oauth";
import { backupProviderSchema } from "~/lib/schemas/backup.schema";
import { logger } from "~/lib/utils/logger";

/**
 * Starts the Cloud Backup OAuth dance: validates the provider, requires a
 * signed-in user, then 302s to the provider's consent screen. The provider
 * round-trips the signed provider id through the `state` param.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerRaw } = await context.params;
  const provider = backupProviderSchema.safeParse(providerRaw);
  if (!provider.success) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const { user } = await requireAuthSafe();
  const url = new URL(request.url);
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const authorizeUrl = backupAuthorizeUrl(
    provider.data,
    signState(provider.data, user.id),
    url.origin,
  );
  if (!authorizeUrl) {
    logger.warn("Cloud backup provider not configured", {
      provider: provider.data,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=backup&backup=unconfigured", url.origin),
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
