import { afterEach, expect, it, vi } from "vitest";
import {
  readAuthReturnPath,
  rememberAuthReturnPath,
  safeReturnPath,
} from "./authNavigation";

afterEach(() => vi.unstubAllGlobals());

it("preserves the destination without adding a callback query string", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  rememberAuthReturnPath("/characters/123/sheet");
  expect(readAuthReturnPath(null)).toBe("/characters/123/sheet");
  expect(readAuthReturnPath(null)).toBe("/characters/123/sheet");
  expect(readAuthReturnPath("/campaigns/join")).toBe("/campaigns/join");
  rememberAuthReturnPath("//evil.test");
  expect(readAuthReturnPath(null)).toBe("/");
});
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
