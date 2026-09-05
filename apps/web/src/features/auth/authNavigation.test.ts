import { expect, it } from "vitest";
import { safeReturnPath } from "./authNavigation";
it("preserves internal destinations and rejects external or looping redirects", () => {
  expect(safeReturnPath("/characters/123/sheet?view=all")).toBe(
    "/characters/123/sheet?view=all",
  );
  for (const path of [
    "//evil.test",
    "https://evil.test",
    "/\\evil.test",
    "/auth/callback",
    "/sign-in",
    null,
  ])
    expect(safeReturnPath(path)).toBe("/");
});
