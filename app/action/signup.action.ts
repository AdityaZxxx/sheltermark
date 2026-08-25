"use server";

import { z } from "zod";

import type { ActionResult } from "~/lib/action-result";

import { friendlyAuthError } from "~/lib/supabase/auth-error";
import {
  authCallbackUrl,
  getRequestBaseUrl,
} from "~/lib/supabase/request-base-url";
import { createClient } from "~/lib/supabase/server";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signupWithEmail(
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const next = formData.get("next")?.toString();
  formData.delete("next");

  const result = signupSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? "Invalid signup data",
    };
  }

  const { name, email, password } = result.data;
  const redirectUrl = authCallbackUrl(await getRequestBaseUrl(), next);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    return { success: false, error: friendlyAuthError(error) };
  }

  return { success: true, data: null };
}
