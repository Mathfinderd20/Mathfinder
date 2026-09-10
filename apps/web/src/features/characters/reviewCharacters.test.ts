import content from "../../../public/usable-content.json?raw";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  buildCharacter,
  computeSheet,
  validateBuild,
} from "@mathfinder/rules-engine";
import { createReviewCharacters } from "./reviewCharacters";
import {
  loadRuntimeContent,
  RUNTIME_ARCHETYPES,
  RUNTIME_CLASSES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_FEATS,
  RUNTIME_SPELLS,
} from "../../content";

beforeAll(async () => {
  vi.stubGlobal("window", { location: { origin: "http://localhost" } });
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(content, {
        headers: { "content-type": "application/json" },
      }),
  );
  await loadRuntimeContent();
});
afterAll(() => vi.unstubAllGlobals());
it("builds four complete level-eight review characters against the actual catalog", () => {
  const characters = createReviewCharacters();
  expect(characters).toHaveLength(4);
  for (const { build, details } of characters) {
    expect(build.levels).toHaveLength(8);
    const issues = validateBuild(
      build,
      RUNTIME_CLASSES,
      RUNTIME_SPELLS,
      RUNTIME_ARCHETYPES,
      RUNTIME_FEATS,
    );
    expect(
      issues.filter((issue) => issue.severity === "error"),
      build.name,
    ).toEqual([]);
    const sheet = computeSheet(
      buildCharacter(
        build,
        RUNTIME_CLASSES,
        RUNTIME_FEATS,
        RUNTIME_CLASS_FEATURES,
        RUNTIME_ARCHETYPES,
      ),
      { spellRegistry: RUNTIME_SPELLS },
    );
    expect(sheet.hitPoints.total).toBeGreaterThan(20);
    if (build.name === "Mara Ironwood") expect(sheet.hitPoints.total).toBe(84);
    if (build.name === "Sir Sprocket Soupbane")
      expect(sheet.hitPoints.total).toBe(101);
    expect(sheet.weapons.length).toBeGreaterThanOrEqual(2);
    expect(details.notes).toHaveLength(3);
    if (build.name === "Elian Dawnscribe") {
      expect(sheet.spellcasting).toHaveLength(2);
      for (const source of sheet.spellcasting)
        expect(source.casterLevel).toBe(4);
    }
  }
});
