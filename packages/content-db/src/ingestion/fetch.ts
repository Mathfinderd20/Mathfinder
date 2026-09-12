import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";
import { canonicalUrl, pageKind } from "./d20pfsrd";

export const CRAWL_POLICY = Object.freeze({
  maxPages: 100,
  maxDepth: 3,
  maxRuntimeMs: 15 * 60_000,
  maxBytes: 2_000_000,
  concurrency: 1,
  spacingMs: 1500,
  timeoutMs: 20_000,
  attempts: 3,
  maxRedirects: 4,
});
export const USER_AGENT = "DireSheetsContentBot/1.0";
export function publicIpv4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number) as [
    number,
    number,
    number,
    number,
  ];
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 ||
        (b === 0 && (c === 0 || c === 2)) ||
        (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
export function robotsPolicy(
  text: string,
  path: string,
): { allowed: boolean; delayMs: number } {
  const groups: Array<{
    agents: string[];
    rules: Array<{ allow: boolean; path: string }>;
    delay: number;
  }> = [];
  let group: (typeof groups)[number] | undefined;
  let directives = false;
  for (const line of text.split(/\r?\n/)) {
    const pair = line.replace(/#.*/, "").match(/^\s*([^:]+):\s*(.*?)\s*$/);
    if (!pair) continue;
    const key = pair[1]!.toLowerCase();
    const value = pair[2]!;
    if (key === "user-agent") {
      if (!group || directives) {
        group = { agents: [], rules: [], delay: 0 };
        groups.push(group);
        directives = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group) {
      directives = true;
      if (["allow", "disallow"].includes(key) && value)
        group.rules.push({ allow: key === "allow", path: value });
      if (key === "crawl-delay") {
        const seconds = Number(value);
        if (!Number.isFinite(seconds) || seconds < 0)
          throw new Error("Unsupported robots delay");
        group.delay = seconds * 1000;
      }
    }
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && USER_AGENT.toLowerCase().startsWith(a)),
  );
  const chosen = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes("*"));
  const matching = chosen
    .flatMap((g) => g.rules)
    .filter((r) => {
      const pattern = r.path
        .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp(`^${pattern}`).test(path);
    })
    .sort(
      (a, b) =>
        b.path.length - a.path.length || Number(b.allow) - Number(a.allow),
    );
  return {
    allowed: matching[0]?.allow ?? true,
    delayMs: Math.max(0, ...chosen.map((g) => g.delay)),
  };
}
export interface RetrievedPage {
  url: string;
  html: string;
  retrievedAt: string;
}
export type PageFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<RetrievedPage>;

/** Job-scoped retrieval: validate DNS before each request. Node pins connections;
 * a runtime transport must enforce public-only routing at connection time. */
export interface TransportResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: (AsyncIterable<Uint8Array> & { cancel(): Promise<void> }) | null;
}
export type HttpRequestOptions = {
  signal: AbortSignal;
  headers: Record<string, string>;
  redirect: "manual";
};
export type FetchTransport = {
  resolve(hostname: string): Promise<Array<{ address: string }>>;
} & (
  | { agent(address: string, hostname: string): Agent; request?: never }
  | {
      agent?: never;
      request(
        url: string,
        options: HttpRequestOptions,
      ): Promise<TransportResponse>;
    }
);
export function createFetcher(transport?: FetchTransport): PageFetcher {
  let robots: string | undefined;
  let lastRequest = 0;
  let requestCount = 0;
  const started = Date.now();
  async function request(
    input: string,
    signal: AbortSignal,
    robotsRequest = false,
  ): Promise<RetrievedPage> {
    let url = canonicalUrl(input);
    for (let redirect = 0; redirect <= CRAWL_POLICY.maxRedirects; redirect++) {
      if (!robotsRequest) pageKind(url);
      const parsed = new URL(url);
      const policy = robotsPolicy(
        robots ?? "",
        parsed.pathname + parsed.search,
      );
      if (!robotsRequest && !policy.allowed)
        throw new Error("Robots policy disallows this page");
      for (let attempt = 0; attempt < CRAWL_POLICY.attempts; attempt++) {
        signal.throwIfAborted();
        if (
          Date.now() - started > CRAWL_POLICY.maxRuntimeMs ||
          ++requestCount >
            (CRAWL_POLICY.maxPages + 1) *
              CRAWL_POLICY.attempts *
              (CRAWL_POLICY.maxRedirects + 1)
        )
          throw new Error("Crawl runtime/request limit reached");
        const delay =
          Math.max(CRAWL_POLICY.spacingMs, policy.delayMs) -
          (Date.now() - lastRequest);
        if (delay > CRAWL_POLICY.maxRuntimeMs - (Date.now() - started))
          throw new Error("Robots delay exceeds job runtime");
        if (delay > 0)
          await new Promise<void>((resolve, reject) => {
            const abort = () => {
              clearTimeout(timer);
              reject(new Error("Cancelled"));
            };
            const timer = setTimeout(() => {
              signal.removeEventListener("abort", abort);
              resolve();
            }, delay);
            signal.addEventListener("abort", abort, { once: true });
          });
        const addresses = transport
          ? await transport.resolve(parsed.hostname)
          : await lookup(parsed.hostname, {
              family: 4,
              all: true,
            });
        if (!addresses.length || addresses.some((a) => !publicIpv4(a.address)))
          throw new Error("Blocked DNS destination");
        const address = addresses[0]!.address;
        const agent = transport?.request
          ? undefined
          : transport
            ? transport.agent(address, parsed.hostname)
            : new Agent({
                connect: {
                  lookup: (_hostname, options, callback) => {
                    if (options.all) callback(null, [{ address, family: 4 }]);
                    else callback(null, address, 4);
                  },
                },
              });
        lastRequest = Date.now();
        try {
          const options: HttpRequestOptions = {
            redirect: "manual",
            signal: AbortSignal.any([
              signal,
              AbortSignal.timeout(CRAWL_POLICY.timeoutMs),
            ]),
            headers: {
              "user-agent": USER_AGENT,
              accept: robotsRequest ? "text/plain" : "text/html",
            },
          };
          const response = transport?.request
            ? await transport.request(url, options)
            : await fetch(url, { ...options, dispatcher: agent });
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const destination = response.headers.get("location");
            await response.body?.cancel();
            if (!destination) throw new Error("Redirect without destination");
            url = canonicalUrl(destination, url);
            if (robotsRequest && new URL(url).pathname !== "/robots.txt")
              throw new Error("Unsupported robots redirect");
            break;
          }
          if (response.status === 429 || response.status >= 500) {
            const retryAfter = response.headers.get("retry-after");
            await response.body?.cancel();
            if (attempt + 1 === CRAWL_POLICY.attempts)
              throw new Error(`HTTP ${response.status}; retries exhausted`);
            const seconds =
              retryAfter === null ? 2 ** attempt : Number(retryAfter);
            const until = Number.isFinite(seconds)
              ? Date.now() + seconds * 1000
              : Date.parse(retryAfter!);
            if (
              !Number.isFinite(until) ||
              until - Date.now() > CRAWL_POLICY.maxRuntimeMs
            )
              throw new Error("Rate limited; retry later");
            lastRequest = Math.max(lastRequest, until);
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`HTTP ${response.status}`);
          }
          if (
            !robotsRequest &&
            !response.headers.get("content-type")?.includes("text/html")
          ) {
            await response.body?.cancel();
            throw new Error("Unsupported content type");
          }
          if (
            Number(response.headers.get("content-length")) >
            CRAWL_POLICY.maxBytes
          ) {
            await response.body?.cancel();
            throw new Error("Response too large");
          }
          const chunks: Uint8Array[] = [];
          let bytes = 0;
          for await (const chunk of response.body ?? []) {
            bytes += chunk.length;
            if (bytes > CRAWL_POLICY.maxBytes)
              throw new Error("Response too large");
            chunks.push(chunk);
          }
          const html = Buffer.concat(chunks).toString("utf8");
          if (robotsRequest && /<html/i.test(html))
            throw new Error("Robots access challenge");
          return { url, html, retrievedAt: new Date().toISOString() };
        } finally {
          await agent?.close();
        }
      }
    }
    throw new Error("Redirect limit reached");
  }
  return async (url, signal) => {
    if (robots === undefined)
      robots = (
        await request("https://www.d20pfsrd.com/robots.txt", signal, true)
      ).html;
    return request(url, signal);
  };
}
