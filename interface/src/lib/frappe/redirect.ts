const DEFAULT_REDIRECT = "/os";

// `next` round-trips through a URL query param the browser controls, so it
// must be constrained to a same-app relative path — "//evil.com" is parsed by
// browsers as protocol-relative and would otherwise send a logged-in user off-site.
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
