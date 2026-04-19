"use server";

import { z } from "zod";
import { createClient } from "~/utils/supabase/server";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signupWithEmail(formData: FormData) {
  const supabase = await createClient();

  const next = formData.get("next")?.toString();
  formData.delete("next");

  const rawData = Object.fromEntries(formData.entries());
  const validated = signupSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { name, email, password } = validated.data;

  const redirectUrl = next
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
    : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard`;

  const { data, error } = await supabase.auth.signUp({
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
    return { error: error.message };
  }

  return { success: true, data };
}
