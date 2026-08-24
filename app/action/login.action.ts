"use server";

import { redirect } from "next/navigation";
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

  // The client navigates to this URL; the action must not redirect() itself.
  // A redirect thrown from a server action rejects the awaited call on the
  // client, which form-level catch blocks mistake for a login failure.
  return { success: true, data: data.url };
}

export async function loginWithEmail(
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const rawData = Object.fromEntries(formData.entries());
  const validated = loginSchema.safeParse(rawData);

  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid login data";
    return { success: false, error: msg };
  }

  const { email, password } = validated.data;

  const { error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
    return { success: false, error: friendlyAuthError(loginError) };
  }

  return { success: true, data: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
