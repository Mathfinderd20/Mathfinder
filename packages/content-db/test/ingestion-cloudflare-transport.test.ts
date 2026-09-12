import { afterEach, expect, it, vi } from "vitest";
import { publicNetworkRequest } from "../src/ingestion/cloudflare/transport";
import { createFetcher } from "../src/ingestion/fetch";
const url = "https://www.d20pfsrd.com/magic/all-spells/m/mage-armor/";
afterEach(() => vi.unstubAllGlobals());
it("uses manual redirects and cancels a streamed response when consumption stops", async () => {
  let cancelled = false;
  const mock = vi.fn(
    async (_input: unknown, _init?: unknown) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "text/html" } },
      ),
  );
  vi.stubGlobal("fetch", mock);
  const response = await publicNetworkRequest(url, {
    redirect: "manual",
    signal: new AbortController().signal,
    headers: { "user-agent": "test" },
  });
  for await (const chunk of response.body!) {
    expect(chunk.length).toBe(2);
    break;
  }
  expect(cancelled).toBe(true);
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
    method: "GET",
    redirect: "manual",
  });
  await expect(
    publicNetworkRequest("https://127.0.0.1/", {
      redirect: "manual",
      signal: new AbortController().signal,
      headers: {},
    }),
  ).rejects.toThrow();
  expect(mock).toHaveBeenCalledTimes(1);
});
it("blocks a DNS change to a private address before making the next source request", async () => {
  let resolutions = 0;
  const request = vi.fn(async () => ({
    status: 200,
    ok: true,
    headers: new Headers(),
    body: null,
  }));
  const fetcher = createFetcher({
    resolve: async () => [
      { address: ++resolutions === 1 ? "69.164.217.55" : "169.254.169.254" },
    ],
    request,
  });
  await expect(fetcher(url, new AbortController().signal)).rejects.toThrow(
    "Blocked DNS destination",
  );
  expect(request).toHaveBeenCalledTimes(1); // robots only; never the private detail destination
});
