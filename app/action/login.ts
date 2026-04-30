"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "~/lib/action-result";
import { createClient } from "~/utils/supabase/server";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function loginWithGoogle(
  next?: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const redirectUrl = next
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
    : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard`;

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
    return { success: false, error: validated.error.issues[0].message };
  }

  const { email, password } = validated.data;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
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
