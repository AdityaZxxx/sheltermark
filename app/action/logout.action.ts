"use server";

import { redirect } from "next/navigation";

import { createClient } from "~/lib/supabase/server";

export async function logout(): Promise<never> {
  const supabase = await createClient();

  // scope "local": terminate only this device's session. The default
  // ("global") also revokes refresh tokens on every other device, which
  // looks to those devices like a forced logout.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
