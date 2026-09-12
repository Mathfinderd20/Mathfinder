import { resolvePublicAddresses } from "./dns";
import {
  createFetcher,
  type HttpRequestOptions,
  type TransportResponse,
} from "../fetch";
import { canonicalUrl } from "../d20pfsrd";

/** Requires global_fetch_strictly_public and no private-network/origin bindings.
 * Cloudflare enforces public-only destination routing at connection time, including
 * DNS changes after our preflight. Node continues to use its IP-pinned Agent.
 * See docs/ingestion/HOSTED-STAGING-PLAN.md for the runtime security contract.
 */
export async function publicNetworkRequest(
  url: string,
  options: HttpRequestOptions,
): Promise<TransportResponse> {
  if (canonicalUrl(url) !== url) throw new Error("Unsupported destination URL");
  const response = await globalThis.fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: options.signal,
    headers: options.headers,
  });
  const body = response.body;
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body: body
      ? {
          cancel: () => body.cancel(),
          async *[Symbol.asyncIterator]() {
            const reader = body.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                yield value;
              }
            } finally {
              await reader.cancel();
              reader.releaseLock();
            }
          },
        }
      : null,
  };
}
export function cloudflareFetcher() {
  return createFetcher({
    resolve: resolvePublicAddresses,
    request: publicNetworkRequest,
  });
}
