"use server";

import type { User } from "@supabase/supabase-js";
import { createClient } from "~/utils/supabase/server";

export interface AuthResult {
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

export interface AuthSafeResult {
  user: User | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Require authentication - throws error if not authenticated
 * Use for protected server actions
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { user, supabase };
}

/**
 * Safe authentication check - returns null user if not authenticated
 * Use for optional auth operations
 */
export async function requireAuthSafe(): Promise<AuthSafeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabase };
}
