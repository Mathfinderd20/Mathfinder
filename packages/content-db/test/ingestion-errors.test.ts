import { expect, it } from "vitest";
import { ingestionErrorCode } from "../src/ingestion/errors";
it("preserves actionable nested transport failures without storing arbitrary content", () => {
  expect(
    ingestionErrorCode(
      new Error("fetch failed", {
        cause: new Error(
          "proxy request failed, cannot connect to the specified address",
        ),
      }),
    ),
  ).toBe("runtime-network-proxy-rejected");
  expect(
    ingestionErrorCode(
      new Error("fetch failed", {
        cause: new Error("TLS destination verification failed"),
      }),
    ),
  ).toBe("tls-verification-failed");
  expect(ingestionErrorCode(new Error("source content or secret"))).toBe(
    "fetch-or-parse-failed",
  );
  const cycle = new Error("cycle");
  cycle.cause = cycle;
  expect(ingestionErrorCode(cycle)).toBe("fetch-or-parse-failed");
});
