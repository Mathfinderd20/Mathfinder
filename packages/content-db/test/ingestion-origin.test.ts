import { expect, it } from "vitest";
import { permittedOrigin, authorize } from "../src/ingestion/auth";

const origin = "https://stage.diresheets.com";
it("accepts browser same-origin GET without Origin but blocks missing/cross-site metadata and POSTs", () => {
  const request = (
    headers: Record<string, string>,
    method = "GET",
    url = origin,
  ) => new Request(url + "/api/ingestion/jobs", { headers, method });
  expect(
    permittedOrigin(request({ "sec-fetch-site": "same-origin" }), origin),
  ).toBe(true);
  expect(permittedOrigin(request({ origin }), origin)).toBe(true);
  expect(permittedOrigin(request({}), origin)).toBe(false);
  expect(
    permittedOrigin(request({ "sec-fetch-site": "cross-site" }), origin),
  ).toBe(false);
  expect(
    permittedOrigin(
      request({ "sec-fetch-site": "same-origin" }, "POST"),
      origin,
    ),
  ).toBe(false);
  expect(
    permittedOrigin(
      request(
        { "sec-fetch-site": "same-origin" },
        "GET",
        "https://other.invalid",
      ),
      origin,
    ),
  ).toBe(false);
  expect(
    permittedOrigin(
      request({
        "sec-fetch-site": "same-origin",
        origin: "https://evil.invalid",
      }),
      origin,
    ),
  ).toBe(false);
});

it("never follows an Auth redirect with the bearer credential", async () => {
  const config = {
    origin,
    supabaseUrl: "https://pkupqzdnefnjwndwzhdr.supabase.co",
    publishableKey: "fixture",
    permissionReviewId: "fixture",
    targetVerificationId: "fixture",
  };
  let calls = 0;
  const transport: typeof fetch = async (_url, init) => {
    calls++;
    expect(init?.redirect).toBe("manual");
    return new Response(null, {
      status: 302,
      headers: { location: "https://other.invalid" },
    });
  };
  await expect(authorize(config, "Bearer token", transport)).rejects.toThrow(
    "Unauthorized",
  );
  expect(calls).toBe(1);
});
