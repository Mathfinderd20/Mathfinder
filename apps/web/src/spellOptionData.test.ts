import { describe, expect, it, vi } from "vitest";
import {
  buildSpellCompendiumOptions,
  filterSpellCompendiumOptions,
  spellAvailableLevels,
} from "./spellOptionData";

vi.mock("./content", async () => {
  const { getSpell, SPELLS } = await import("@mathfinder/rules-engine");
  return { getRuntimeSpell: (name: string) => getSpell(SPELLS, name) };
});

const OPTIONS = [
  { id: "magic-missile", name: "Magic Missile" },
  { id: "bless", name: "Bless" },
  { id: "detect-magic", name: "Detect Magic" },
  { id: "catalog-only", name: "Catalog-only spell", source: "Custom pack" },
];

describe("class-filtered spell compendium", () => {
  it("limits the picker to any of the character's caster classes", () => {
    expect(
      buildSpellCompendiumOptions(OPTIONS, [" WIZARD "]).map(
        (option) => option.id,
      ),
    ).toEqual(["magic-missile", "detect-magic"]);
    expect(
      buildSpellCompendiumOptions(OPTIONS, ["wizard", "Cleric"]).map(
        (option) => option.id,
      ),
    ).toEqual(["magic-missile", "bless", "detect-magic"]);
  });

  it("retains the indexed level, school, tag, and text filters", () => {
    const options = buildSpellCompendiumOptions(OPTIONS, ["wizard"]);
    expect(spellAvailableLevels(options[0]!, " WIZARD ")).toEqual([1]);
    expect(
      filterSpellCompendiumOptions(options, {
        classKey: "Wizard",
        level: 1,
        school: "Evocation",
        tag: "damage",
        query: "MISSILE",
      }).map((option) => option.id),
    ).toEqual(["magic-missile"]);
    expect(
      filterSpellCompendiumOptions(options, { classKey: "wizard", level: 2 }),
    ).toEqual([]);
  });

  it("preserves the full catalog when no caster filter is supplied", () => {
    for (const classes of [undefined, [], [" "]]) {
      const options = buildSpellCompendiumOptions(OPTIONS, classes);
      expect(options.map((option) => option.id)).toEqual(
        OPTIONS.map((option) => option.id),
      );
      expect(options[3]).toMatchObject({
        sourceTag: "Custom pack",
        supportTag: "catalog-only",
        classLevels: {},
      });
    }
  });
});
