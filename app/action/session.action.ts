"use server";

import type { ActionResult } from "~/lib/action-result";

import { supabaseError } from "~/lib/action-result";
import { requireAuth } from "~/lib/auth";

/**
 * Remote session management. Supabase Auth only exposes coarse sign-out
 * scopes — there is no API to list or revoke a single session by ID — so
 * device session control is limited to "everything but this device" and
 * "everything, including this device".
 */
export async function signOutOtherSessions(): Promise<ActionResult<null>> {
  const { supabase } = await requireAuth();

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    return supabaseError("session.signOutOtherSessions", error);
  }

  return { success: true, data: null };
}

export async function signOutAllSessions(): Promise<ActionResult<null>> {
  const { supabase } = await requireAuth();

  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    return supabaseError("session.signOutAllSessions", error);
  }

  return { success: true, data: null };
}
