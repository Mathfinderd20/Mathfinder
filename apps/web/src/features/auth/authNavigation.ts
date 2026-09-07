const RETURN_PATH_KEY = "mathfinder:auth:return-path";

export function rememberAuthReturnPath(path: string) {
  window.sessionStorage.setItem(RETURN_PATH_KEY, safeReturnPath(path));
}

export function readAuthReturnPath(queryPath: string | null): string {
  const saved = window.sessionStorage.getItem(RETURN_PATH_KEY);
  return safeReturnPath(queryPath ?? saved);
}

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
