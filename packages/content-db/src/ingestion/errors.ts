/** Curated codes only: never persist raw server messages, source content or credentials. */
export function ingestionErrorCode(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<Error>();
  for (
    let current = error;
    current instanceof Error && !seen.has(current) && seen.size < 5;
    current = current.cause
  ) {
    seen.add(current);
    messages.push(current.message);
  }
  const message = messages.join("\n");
  if (
    /proxy request failed|cannot connect to the specified address/i.test(
      message,
    )
  )
    return "runtime-network-proxy-rejected";
  if (/TLS destination|certificate|CERT_|SSL_/i.test(message))
    return "tls-verification-failed";
  if (/not implemented|not supported in this runtime/i.test(message))
    return "runtime-transport-unsupported";
  if (/Storage row limit/.test(message))
    return "storage-row-limit-requires-fragmentation";
  if (/source policy/.test(message)) return "source-policy-changed-review";
  if (/layout|heading/i.test(message)) return "unsupported-layout";
  if (/Robots/.test(message)) return "robots-denied";
  if (/limit|large/i.test(message)) return "crawl-limit";
  if (/DNS|destination|URL/.test(message)) return "blocked-destination";
  if (/HTTP 4/.test(message)) return "source-access-denied";
  return "fetch-or-parse-failed";
}
