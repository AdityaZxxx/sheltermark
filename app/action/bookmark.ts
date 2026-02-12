"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "~/utils/supabase/server";

const bookmarkSchema = z.object({
  url: z.url("invalid URL"),
  workspaceId: z.uuid(),
});

/**
 * Basic metadata fetching from URL using regex
 */
async function fetchMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return { title: url };

    const html = await response.text();

    const getMeta = (property: string) => {
      const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i",
      );
      let match = html.match(regex);
      if (!match) {
        const regexAlt = new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
          "i",
        );
        match = html.match(regexAlt);
      }
      return match ? match[1] : null;
    };

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = getMeta("og:title") || titleMatch?.[1] || url;
    const ogImage = getMeta("og:image");

    // Favicon detection
    const faviconRegex =
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i;
    const faviconMatch = html.match(faviconRegex);
    let faviconUrl = faviconMatch?.[1];

    if (faviconUrl && !faviconUrl.startsWith("http")) {
      const urlObj = new URL(url);
      faviconUrl = `${urlObj.origin}${faviconUrl.startsWith("/") ? "" : "/"}${faviconUrl}`;
    }

    return {
      title: title.trim(),
      og_image_url: ogImage,
      favicon_url: faviconUrl,
    };
  } catch (_e) {
    return {
      title: url,
    };
  }
}

export async function addBookmark(formData: FormData) {
  const supabase = await createClient();
  const rawUrl = formData.get("url") as string;
  const workspaceId = formData.get("workspaceId") as string;

  const validated = bookmarkSchema.safeParse({
    url: rawUrl,
    workspaceId: workspaceId === "null" || !workspaceId ? null : workspaceId,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if bookmark already exists in workspace (BEFORE fetching metadata)
  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("workspace_id", validated.data.workspaceId ?? null)
    .eq("url", validated.data.url)
    .maybeSingle();

  if (existing) {
    return { error: "Bookmark already exists in this workspace" };
  }

  const metadata = await fetchMetadata(validated.data.url);

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([
      {
        user_id: user.id,
        url: validated.data.url,
        title: metadata.title,
        favicon_url: metadata.favicon_url,
        og_image_url: metadata.og_image_url,
        workspace_id: validated.data.workspaceId,
      },
    ])
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function deleteBookmarks(ids: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function moveBookmarks(ids: string[], targetWorkspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("bookmarks")
    .update({
      workspace_id: targetWorkspaceId === "null" ? null : targetWorkspaceId,
    })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function renameBookmark(id: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("bookmarks")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getBookmarks(workspaceId?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Not authenticated" };

  let query = supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  } else {
    query = query.is("workspace_id", null);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}
