"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "~/utils/supabase/server";

const resetPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

export async function resetPasswordForEmail(formData: FormData) {
  const supabase = await createClient();

  const rawData = Object.fromEntries(formData.entries());
  const validated = resetPasswordSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { email } = validated.data;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const rawData = Object.fromEntries(formData.entries());
  const validated = updatePasswordSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { password } = validated.data;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
