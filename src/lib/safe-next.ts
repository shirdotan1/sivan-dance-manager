/**
 * Validates the post-login `next` target so login can't be turned into an
 * open redirect. Accepts only same-origin, root-relative paths; anything
 * else falls back to the home page.
 *
 * Rejected: non-strings, values not starting with a single "/", any
 * backslash (browsers treat "\" like "/", so "/\evil.com" becomes
 * "//evil.com"), control characters, and anything that resolves to a
 * different origin, before or after normalization ("//evil.com",
 * "/..//evil.com"). An encoded "/%2F%2Fevil.com" stays a same-origin path.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  const value = next.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  const base = "https://same-origin.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return "/";
  }
  if (url.origin !== base) return "/";
  // Check the normalized result too: "/..//evil.com" normalizes to "//evil.com",
  // which a browser would treat as another origin.
  const target = url.pathname + url.search + url.hash;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return "/";
  return target;
}
