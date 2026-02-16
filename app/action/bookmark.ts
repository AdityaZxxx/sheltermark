"use server";

import dns from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { requireAuth } from "~/lib/auth";

const bookmarkSchema = z.object({
  url: z.url("invalid URL"),
  workspaceId: z.uuid().nullable(),
});

/**
 * Validates if an IP address is private or reserved
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, p1, p2] = ipv4Match.map(Number);
    if (p1 === 10) return true; // 10.0.0.0/8
    if (p1 === 127) return true; // 127.0.0.0/8
    if (p1 === 169 && p2 === 254) return true; // 169.254.0.0/16
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true; // 172.16.0.0/12
    if (p1 === 192 && p2 === 168) return true; // 192.168.0.0/16
    if (p1 === 0) return true; // 0.0.0.0/8
    if (p1 >= 224) return true; // Multicast/Reserved
  }

  // IPv6 checks
  const ipLower = ip.toLowerCase();
  if (
    ipLower === "::1" ||
    ipLower === "::" ||
    ipLower.startsWith("fe80:") || // link-local
    ipLower.startsWith("fc00:") || // unique local
    ipLower.startsWith("fd00:") || // unique local
    ipLower.startsWith("ff00:") // multicast
  ) {
    return true;
  }

  return false;
}

/**
 * Validates if a URL is safe for server-side fetching (SSRF protection)
 */
async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);

    // 1. Enforce allowed schemes (only https)
    if (urlObj.protocol !== "https:") return false;

    const hostname = urlObj.hostname;

    // 2. Check if hostname is an IP and if it's private
    if (isIP(hostname)) {
      return !isPrivateIP(hostname);
    }

    // 3. Resolve hostname to IP and check if it's private
    // Using a timeout to prevent DNS hang
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const lookup = await dns.lookup(hostname);
      clearTimeout(timeout);
      return !isPrivateIP(lookup.address);
    } catch {
      clearTimeout(timeout);
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Basic metadata fetching from URL using regex
 */
async function fetchMetadata(url: string) {
  // Validate and sanitize URL before performing fetch
  if (!(await isSafeUrl(url))) {
    return { title: url };
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
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
  const rawUrl = formData.get("url") as string;
  const workspaceId = formData.get("workspaceId") as string;

  const validated = bookmarkSchema.safeParse({
    url: rawUrl,
    workspaceId: workspaceId === "null" || !workspaceId ? null : workspaceId,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { user, supabase } = await requireAuth();

  // Check if bookmark already exists in workspace (BEFORE fetching metadata)
  const workspaceIdValue = validated.data.workspaceId;
  let existingQuery = supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("url", validated.data.url);

  if (workspaceIdValue) {
    existingQuery = existingQuery.eq("workspace_id", workspaceIdValue);
  } else {
    existingQuery = existingQuery.is("workspace_id", null);
  }

  // Parallel: check duplicate + fetch metadata simultaneously
  const [existing, metadata] = await Promise.all([
    existingQuery.maybeSingle(),
    fetchMetadata(validated.data.url),
  ]);

  if (existing.data) {
    return { error: "Bookmark already exists in this workspace" };
  }

  const insertData = {
    user_id: user.id,
    url: validated.data.url,
    title: metadata.title,
    favicon_url: metadata.favicon_url,
    og_image_url: metadata.og_image_url,
    workspace_id: validated.data.workspaceId,
  };

  const { data, error } = await supabase
    .from("bookmarks")
    .insert([insertData])
    .select()
    .single();

  if (error) return { error: error.message };

  return { success: true, data };
}

export async function deleteBookmarks(ids: string[]) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function moveBookmarks(ids: string[], targetWorkspaceId: string) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .update({
      workspace_id: targetWorkspaceId === "null" ? null : targetWorkspaceId,
    })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function renameBookmark(id: string, title: string) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("bookmarks")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function getBookmarks() {
  const { user, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { data: data || [], error: error?.message };
}
