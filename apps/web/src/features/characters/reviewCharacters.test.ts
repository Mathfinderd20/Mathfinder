import content from "../../../public/usable-content.json?raw";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  buildCharacter,
  computeSheet,
  validateBuild,
  BLOODLINES,
  DOMAINS,
  getSpell,
} from "@mathfinder/rules-engine";
import {
  createReviewCharacters,
  createReviewSorcerer,
} from "./reviewCharacters";
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
it("resolves every core domain and bloodline grant to a full runtime spell entry", () => {
  const names = [
    ...Object.values(DOMAINS).flatMap((domain) => Object.values(domain.spells)),
    ...Object.values(BLOODLINES).flatMap(
      (bloodline) => bloodline.bonusSpells ?? [],
    ),
  ];
  expect(names.length).toBeGreaterThan(300);
  for (const name of names)
    expect(getSpell(RUNTIME_SPELLS, name!), name).toBeDefined();
});
it("builds a level-twenty Sorcerer with all base known spells and ninth-level slots", () => {
  const { build } = createReviewSorcerer();
  expect(build.levels).toHaveLength(20);
  expect(
    validateBuild(
      build,
      RUNTIME_CLASSES,
      RUNTIME_SPELLS,
      RUNTIME_ARCHETYPES,
      RUNTIME_FEATS,
    ).filter((issue) => issue.severity === "error"),
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
  expect(sheet.hitPoints.total).toBeGreaterThan(200);
  expect(sheet.spellcasting[0]?.casterLevel).toBe(20);
  expect(sheet.spellcasting[0]?.spellsPerDay[9]).toBe(7);
  expect(sheet.spellcasting[0]?.spellsKnown[9]).toBe(3);
  expect(sheet.spellcasting[0]?.bloodline).toBe("arcane");
  expect(sheet.spellcasting[0]?.grantedSpells[9]).toEqual(["Wish"]);
  expect(
    Object.values(build.spellSelections!.sorcerer!.known!).map(
      (names) => names?.length,
    ),
  ).toEqual([9, 5, 5, 4, 4, 4, 3, 3, 3, 3]);
  const overridden = computeSheet(
    buildCharacter(
      { ...build, carriedWeight: 9999 },
      RUNTIME_CLASSES,
      RUNTIME_FEATS,
      RUNTIME_CLASS_FEATURES,
      RUNTIME_ARCHETYPES,
    ),
  );
  expect(overridden.encumbrance.carriedWeight).toBe(
    sheet.encumbrance.carriedWeight,
  );
});
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
