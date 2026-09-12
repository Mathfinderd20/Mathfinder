import { DETAIL_PATHS, DIRECTORY_PATHS, SOURCE } from "./d20pfsrd";
import { CRAWL_POLICY, USER_AGENT } from "./fetch";

export function policySnapshot(maxEntries: number) {
  return JSON.stringify({
    source: SOURCE,
    version: 3,
    protocols: ["https:"],
    domains: ["www.d20pfsrd.com", "d20pfsrd.com"],
    entryPatterns: DETAIL_PATHS.map((p) => p.source),
    paginationPatterns: DIRECTORY_PATHS.map((p) => p.source),
    queryParameters: { paged: "positive-integer" },
    maxEntries,
    ...CRAWL_POLICY,
    userAgent: USER_AGENT,
  });
}
