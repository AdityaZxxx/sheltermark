// Rejects "//host", "\\", and absolute URLs so ?next= can't become an open redirect.
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
