export function safeReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/";
  const url = new URL(value, "https://mathfinder.invalid");
  if (
    url.origin !== "https://mathfinder.invalid" ||
    url.pathname.startsWith("/auth/") ||
    url.pathname === "/sign-in"
  )
    return "/";
  return url.pathname + url.search + url.hash;
}
