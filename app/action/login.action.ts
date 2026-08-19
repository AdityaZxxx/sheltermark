"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "~/lib/action-result";

import { createClient } from "~/lib/supabase/server";
import { getBaseUrl } from "~/lib/utils";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function loginWithGoogle(
  next?: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const baseUrl = getBaseUrl();
  const redirectUrl = next
    ? `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`
    : `${baseUrl}/auth/callback?next=/dashboard`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    redirect("/auth-code-error");
  }

  if (data.url) {
    redirect(data.url);
  }

  return { success: true, data: null };
}

export async function loginWithEmail(
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const next = formData.get("next")?.toString();
  formData.delete("next");

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
    return { success: false, error: loginError.message };
  }

  const redirectUrl = next || "/dashboard";
  redirect(redirectUrl);

  return { success: true, data: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
