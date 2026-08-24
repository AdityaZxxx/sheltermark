"use server";

import { z } from "zod";

import { GENERIC_ERROR, type ActionResult } from "~/lib/action-result";
import { friendlyAuthError } from "~/lib/supabase/auth-error";
import {
  authCallbackUrl,
  getRequestBaseUrl,
} from "~/lib/supabase/request-base-url";
import { createClient } from "~/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function loginWithGoogle(
  next?: string,
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const redirectUrl = authCallbackUrl(await getRequestBaseUrl(), next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    return { success: false, error: friendlyAuthError(error) };
  }

  if (!data.url) {
    return { success: false, error: GENERIC_ERROR };
  }

  // Return the OAuth URL for client navigation. redirect() would reject the
  // server-action promise and be interpreted as a login failure by the client.
  return { success: true, data: data.url };
}

export async function loginWithEmail(
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const result = loginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? "Invalid login data",
    };
  }

  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    return { success: false, error: friendlyAuthError(error) };
  }

  return { success: true, data: null };
}
