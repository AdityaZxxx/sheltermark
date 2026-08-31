import { NextResponse } from "next/server";

import { requireAuthSafe } from "~/lib/auth";
import { exchangeCodeForTokens, verifyState } from "~/lib/backup/oauth";
import { getDb } from "~/lib/data/db";
import { upsertCloudConnection } from "~/lib/data/repositories/cloud-connection.repository";
import { logger } from "~/lib/utils/logger";

/**
 * Cloud Backup OAuth callback (ADR-0008). The user arrives here from the
 * provider's consent screen; we verify the signed state, exchange the code,
 * and store the connection. A signed-in session is required — anonymous
 * visitors are bounced to login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const { user } = await requireAuthSafe();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (errorParam || !code) {
    logger.warn("Cloud backup OAuth denied", { error: errorParam });
    return NextResponse.redirect(
      new URL("/dashboard?settings=backup&backup=denied", url.origin),
    );
  }

  const provider = verifyState(state, user.id);
  if (!provider) {
    logger.warn("Cloud backup OAuth state invalid");
    return NextResponse.redirect(
      new URL("/dashboard?settings=backup&backup=invalid", url.origin),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(provider, code, url.origin);
    if (!tokens) {
      logger.warn("Cloud backup token exchange failed", { provider });
      return NextResponse.redirect(
        new URL("/dashboard?settings=backup&backup=failed", url.origin),
      );
    }

    const result = await upsertCloudConnection(getDb(), user.id, {
      provider,
      accountEmail: tokens.accountEmail,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    });
    if (!result.success) {
      return NextResponse.redirect(
        new URL("/dashboard?settings=backup&backup=failed", url.origin),
      );
    }

    return NextResponse.redirect(
      new URL("/dashboard?settings=backup&backup=ok", url.origin),
    );
  } catch (cause) {
    logger.error("Cloud backup callback crashed", { error: cause });
    return NextResponse.redirect(
      new URL("/dashboard?settings=backup&backup=failed", url.origin),
    );
  }
}
