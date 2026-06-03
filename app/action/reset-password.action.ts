"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "~/lib/action-result";
import { createClient } from "~/utils/supabase/server";

const resetPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

export async function resetPasswordForEmail(
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const rawData = Object.fromEntries(formData.entries());
  const validated = resetPasswordSchema.safeParse(rawData);

  if (!validated.success) {
    const message = validated.error?.issues?.[0]?.message ?? "Invalid data";
    return { success: false, error: message };
  }

  const email = validated.data?.email;
  if (!email) {
    return { success: false, error: "Email is required" };
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    },
  );

  if (resetError) {
    return { success: false, error: resetError.message };
  }

  return { success: true, data: null };
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

export async function updatePassword(
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const rawData = Object.fromEntries(formData.entries());
  const validated = updatePasswordSchema.safeParse(rawData);

  if (!validated.success) {
    const message = validated.error?.issues?.[0]?.message ?? "Invalid data";
    return { success: false, error: message };
  }

  const password = validated.data?.password;
  if (!password) {
    return { success: false, error: "Password is required" };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: error.message };
  }

  redirect("/dashboard");
  return { success: true, data: null };
}
