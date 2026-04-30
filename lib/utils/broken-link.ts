export function getBrokenLinkMessage(
  status: number | null | undefined,
): string {
  if (!status) return "Link unreachable";
  if (status === 0) return "Connection timeout";
  if (status === 403) return "Access denied by server";
  if (status === 404) return "Page not found";
  if (status === 410) return "Page permanently deleted";
  if (status >= 500) return "Server error";
  if (status >= 400) return `Error (${status})`;
  return "Link issue";
}
