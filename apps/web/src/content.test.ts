import { describe, expect, it } from "vitest";
import { runtimeContentAssetUrl } from "./content";

describe("runtimeContentAssetUrl", () => {
  it("loads content from the app root regardless of the current route", () => {
    expect(runtimeContentAssetUrl("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5173/usable-content.json",
    );
  });
});
