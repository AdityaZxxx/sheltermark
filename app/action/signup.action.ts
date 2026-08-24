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
): Promise<ActionResult<unknown>> {
  const supabase = await createClient();

  const next = formData.get("next")?.toString();
  formData.delete("next");

  const rawData = Object.fromEntries(formData.entries());
  const validated = signupSchema.safeParse(rawData);

  if (!validated.success) {
    const msg = validated.error?.issues?.[0]?.message ?? "Invalid signup data";
    return { success: false, error: msg };
  }

  const { name, email, password } = validated.data;

  const redirectUrl = authCallbackUrl(await getRequestBaseUrl(), next);

  const {
    data: { user, session },
    error,
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
      },
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    return { success: false, error: friendlyAuthError(error) };
  }

  return { success: true, data: { user, session } };
}
