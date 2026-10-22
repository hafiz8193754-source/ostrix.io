/** Same-site return path only. Rejects protocol-relative and absolute URLs. */
export function safeNext(next: string | null | undefined, fallback = "/studio"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) {
    return fallback;
  }
  return next;
}
