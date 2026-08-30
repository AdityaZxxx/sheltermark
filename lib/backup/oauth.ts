import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { BackupProvider } from "~/lib/schemas/backup.schema";

import { backupProviderSchema } from "~/lib/schemas/backup.schema";
import { logger } from "~/lib/utils/logger";

/**
 * OAuth token responses, decoded at the I/O boundary. Providers return
 * different shapes; each parser below narrows its provider's payload.
 */
interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** ISO instant; null when the provider issues non-expiring tokens. */
  expiresAt: string | null;
  accountEmail: string | null;
}

function requireSecrets(
  provider: BackupProvider,
  config: { clientId?: string; clientSecret?: string },
): { clientId: string; clientSecret: string } | null {
  if (!config.clientId || !config.clientSecret) {
    logger.warn("Cloud backup provider not configured", { provider });
    return null;
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret };
}

function siteUrl(origin: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const base = configured ?? origin;
  return base.replace(/\/$/, "");
}

/** Provider-scoped redirect URI for the OAuth dance. */
function backupRedirectUri(origin: string): string {
  return `${siteUrl(origin)}/api/backup/callback`;
}

/**
 * Tamper-proof OAuth state: `provider.userId.expiry.hmac` keyed off the
 * service secret. Binds the callback to the same provider AND the same user
 * session that initiated the dance, with a 10-minute window — an attacker's
 * code+state cannot attach their provider to a victim's account. Fails
 * closed when the secret is absent (no forgeable fallback).
 */
function stateSignature(payload: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for OAuth state");
  }
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signState(provider: BackupProvider, userId: string): string {
  const expiry = Date.now() + 10 * 60 * 1000;
  const payload = `${provider}.${userId}.${expiry}`;
  return `${payload}.${stateSignature(payload)}`;
}

export function verifyState(
  state: string | null,
  userId: string,
): BackupProvider | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const providerRaw = parts[0];
  const userIdRaw = parts[1];
  const expiryRaw = parts[2];
  const signature = parts[3];
  if (!providerRaw || !userIdRaw || !expiryRaw || !signature) return null;
  if (userIdRaw !== userId) return null;
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;

  let expected: string;
  try {
    expected = stateSignature(`${providerRaw}.${userIdRaw}.${expiryRaw}`);
  } catch {
    return null;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const parsed = backupProviderSchema.safeParse(providerRaw);
  if (!parsed.success) return null;
  return parsed.data;
}

export function backupAuthorizeUrl(
  provider: BackupProvider,
  state: string,
  origin: string,
): string | null {
  const config = providerEnvConfig(provider);
  if (!requireSecrets(provider, config)) return null;
  const redirectUri = backupRedirectUri(origin);

  if (provider === "google_drive") {
    const params = new URLSearchParams({
      client_id: config.clientId ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  if (provider === "dropbox") {
    const params = new URLSearchParams({
      client_id: config.clientId ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      token_access_type: "offline",
      state,
    });
    return `https://www.dropbox.com/oauth2/authorize?${params}`;
  }
  const params = new URLSearchParams({
    client_id: config.clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "offline_access Files.ReadWrite Files.ReadWrite.AppFolder",
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

type OAuthConfig = {
  clientId?: string;
  clientSecret?: string;
};

function providerEnvConfig(provider: BackupProvider): OAuthConfig {
  if (provider === "google_drive") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (provider === "dropbox") {
    return {
      clientId: process.env.DROPBOX_CLIENT_ID,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET,
    };
  }
  return {
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
  };
}

const tokenPayloadSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
});

type TokenPayload = z.infer<typeof tokenPayloadSchema>;

/** Decode a provider token response body; null when it lacks an access token. */
function parseTokenResponse(bodyText: string): TokenPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return null;
  }
  const parsed = tokenPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function toTokenSet(
  payload: TokenPayload,
  accountEmail: string | null,
): TokenSet {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
    accountEmail,
  };
}

/**
 * Exchange an authorization code for tokens. Throws on transport failure;
 * returns null on a provider-side rejection (bad code, expired state).
 */
export async function exchangeCodeForTokens(
  provider: BackupProvider,
  code: string,
  origin: string,
): Promise<TokenSet | null> {
  const config = providerEnvConfig(provider);
  const secrets = requireSecrets(provider, config);
  if (!secrets) return null;
  const redirectUri = backupRedirectUri(origin);

  let tokenUrl: string;
  let body: URLSearchParams;
  if (provider === "google_drive") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    body = new URLSearchParams({
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
  } else if (provider === "dropbox") {
    tokenUrl = "https://api.dropboxapi.com/oauth2/token";
    body = new URLSearchParams({
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
  } else {
    tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    body = new URLSearchParams({
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      scope: "offline_access Files.ReadWrite Files.ReadWrite.AppFolder",
    });
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const payload = parseTokenResponse(await response.text());
  if (!payload) return null;

  let accountEmail: string | null = null;
  if (provider === "google_drive") {
    accountEmail = await fetchGoogleEmail(payload.access_token);
  } else if (provider === "dropbox") {
    accountEmail = await fetchDropboxEmail(payload.access_token);
  } else {
    accountEmail = await fetchMicrosoftEmail(payload.access_token);
  }

  return toTokenSet(payload, accountEmail);
}

/** Refresh an access token; null when the grant itself is dead. */
export async function refreshAccessToken(
  provider: BackupProvider,
  refreshToken: string,
): Promise<TokenSet | null> {
  const config = providerEnvConfig(provider);
  const secrets = requireSecrets(provider, config);
  if (!secrets) return null;

  let tokenUrl: string;
  let body: URLSearchParams;
  if (provider === "google_drive") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    body = new URLSearchParams({
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  } else if (provider === "dropbox") {
    tokenUrl = "https://api.dropboxapi.com/oauth2/token";
    body = new URLSearchParams({
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  } else {
    tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    body = new URLSearchParams({
      client_id: secrets.clientId,
      clientSecret: secrets.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const payload = parseTokenResponse(await response.text());
  if (!payload) return null;
  return toTokenSet(payload, null);
}

const emailPayloadSchema = z
  .object({ email: z.string() })
  .or(z.object({ userPrincipalName: z.string() }))
  .transform((value) =>
    "email" in value ? value.email : value.userPrincipalName,
  );

/** Fetch the account email from a userinfo-style endpoint; null on failure. */
async function fetchEmail(
  url: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const parsed = emailPayloadSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  return fetchEmail(
    "https://openidconnect.googleapis.com/v1/userinfo",
    accessToken,
  );
}

async function fetchDropboxEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      "https://api.dropboxapi.com/2/users/get_current_account",
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) return null;
    const parsed = emailPayloadSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function fetchMicrosoftEmail(
  accessToken: string,
): Promise<string | null> {
  return fetchEmail("https://graph.microsoft.com/v1.0/me", accessToken);
}
