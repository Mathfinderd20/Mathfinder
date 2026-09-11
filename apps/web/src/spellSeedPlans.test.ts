import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import {
  applySpellSeedPlans,
  buildSpellbookGrantGroups,
  buildSpellbookGrantPlans,
  buildSpellSeedGroups,
  buildSpellSeedPlans,
  selectedSpellCount,
  spellSeedKey,
  spellSeedSelectionsAreComplete,
  buildStartingSpellPlans,
} from "./spellSeedPlans";

function character(className: string, level = 1): CharacterBuild {
  return {
    name: "Spell choices",
    race: { name: "Human", size: "medium" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 18, wis: 18, cha: 18 },
    levels: Array.from({ length: level }, () => ({
      className,
      hitPointRoll: 6,
    })),
  };
}
const derive = (build: CharacterBuild) =>
  computeSheet(buildCharacter(build)).spellcasting;
const key = spellSeedKey;

describe("shared spell choices", () => {
  it("retains implicit libraries on older characters when adding their first explicit library record", () => {
    const sorcerer = character("Sorcerer", 2);
    sorcerer.spellSelections = {
      sorcerer: {
        known: { 1: ["Magic Missile"] },
      },
    };
    const next = applySpellSeedPlans(
      sorcerer,
      [
        {
          classKey: "sorcerer",
          level: 1,
          mode: "known",
          spells: ["Shield"],
        },
      ],
      derive(sorcerer),
    );
    expect(next.spellLibrary?.sorcerer?.[1]).toEqual([
      "Magic Missile",
      "Shield",
    ]);
    const wizard = character("Wizard", 2);
    wizard.spellSelections = {
      wizard: { prepared: { 1: ["Shield", "Shield"] } },
    };
    const advanced = applySpellSeedPlans(
      wizard,
      [
        {
          classKey: "wizard",
          level: 1,
          mode: "library",
          spells: ["Magic Missile", "Burning Hands"],
        },
      ],
      derive(wizard),
    );
    expect(advanced.spellLibrary?.wizard?.[1]).toEqual([
      "Shield",
      "Magic Missile",
      "Burning Hands",
    ]);
    expect(advanced.spellSelections).toEqual(wizard.spellSelections);
  });
  it("uses the full catalog and the known-spell budget, including partial casters", () => {
    const groups = buildSpellSeedGroups(
      [
        ...derive(character("Wizard")),
        ...derive(character("Bard")),
        ...derive(character("Sorcerer")),
      ],
      {},
    );
    expect(new Set(groups.map((group) => group.className))).toEqual(
      new Set(["Bard", "Sorcerer"]),
    );
    expect(
      groups.find(
        (group) => group.className === "Sorcerer" && group.level === 1,
      )?.capacity,
    ).toBe(2);
    expect(
      groups.find(
        (group) => group.className === "Sorcerer" && group.level === 1,
      )?.suggestions.length,
    ).toBeGreaterThan(4);
  });

  it("never marks a short recommendation list complete before the actual allowance is filled", () => {
    const caster = derive(character("Bard"))[0]!;
    caster.spellsKnown[0] = 6;
    const groups = buildSpellSeedGroups([caster], {}).filter(
      (group) => group.level === 0,
    );
    const picks = Object.fromEntries(
      groups[0]!.suggestions
        .slice(0, 4)
        .map((spell) => [key("bard", 0, spell.spellName), true as const]),
    );
    expect(spellSeedSelectionsAreComplete(groups, picks)).toBe(false);
    const shortCatalog = [
      { ...groups[0]!, suggestions: groups[0]!.suggestions.slice(0, 4) },
    ];
    expect(spellSeedSelectionsAreComplete(shortCatalog, picks)).toBe(false);
  });

  it("preserves existing known spells, other levels and classes, and does not mutate the input", () => {
    const build = character("Sorcerer", 3);
    build.spellSelections = {
      sorcerer: { known: { 0: ["Light"], 1: ["Magic Missile", "Shield"] } },
      cleric: { prepared: { 1: ["Bless"] } },
    };
    build.spellLibrary = { sorcerer: { 1: ["Magic Missile", "Shield"] } };
    const before = structuredClone(build);
    const casters = derive(build);
    const groups = buildSpellSeedGroups(casters, {});
    expect(groups.find((group) => group.level === 1)?.capacity).toBe(1);
    const plans = buildSpellSeedPlans(groups, {
      [key("sorcerer", 1, "Burning Hands")]: true,
    });
    const next = applySpellSeedPlans(build, plans, casters);
    expect(next.spellSelections?.sorcerer?.known?.[1]).toEqual([
      "Magic Missile",
      "Shield",
      "Burning Hands",
    ]);
    expect(next.spellSelections?.sorcerer?.known?.[0]).toEqual(["Light"]);
    expect(next.spellSelections?.cleric).toEqual(build.spellSelections.cleric);
    expect(next.spellLibrary?.sorcerer?.[1]).toEqual([
      "Magic Missile",
      "Shield",
      "Burning Hands",
    ]);
    expect(build).toEqual(before);
  });

  it("rejects excess known spells instead of silently dropping picks", () => {
    const build = character("Sorcerer");
    expect(() =>
      applySpellSeedPlans(
        build,
        [
          {
            classKey: "sorcerer",
            level: 1,
            mode: "known",
            spells: ["Shield", "Magic Missile", "Burning Hands"],
          },
        ],
        derive(build),
      ),
    ).toThrow(/allowance/);
    expect(build.spellSelections).toBeUndefined();
  });

  it("deduplicates known spells case-insensitively while retaining their original spelling", () => {
    const build = character("Sorcerer");
    build.spellSelections = { sorcerer: { known: { 1: ["Magic Missile"] } } };
    const next = applySpellSeedPlans(
      build,
      [
        {
          classKey: "sorcerer",
          level: 1,
          mode: "known",
          spells: ["magic missile", "Shield"],
        },
      ],
      derive(build),
    );
    expect(next.spellSelections?.sorcerer?.known?.[1]).toEqual([
      "Magic Missile",
      "Shield",
    ]);
  });

  it("grants two book spells across unlocked spell levels without changing preparations", () => {
    const build = character("Wizard", 3);
    build.spellLibrary = { wizard: { 1: ["Shield"] } };
    build.spellSelections = {
      wizard: { prepared: { 1: ["Shield", "Shield"] } },
    };
    const casters = derive(build),
      caster = casters[0]!;
    const groups = buildSpellbookGrantGroups(caster, {});
    expect(groups.map((group) => group.level)).toEqual([1, 2]);
    expect(
      groups[0]!.suggestions.some((spell) => spell.spellName === "Shield"),
    ).toBe(false);
    const level2 = groups[1]!.suggestions[0]!.spellName;
    const selections = {
      [key("wizard", 1, "Magic Missile")]: true,
      [key("wizard", 2, level2)]: true,
    } as const;
    const plans = buildSpellbookGrantPlans(groups, selections);
    expect(selectedSpellCount(groups, selections)).toBe(2);
    expect(plans.every((plan) => plan.mode === "library")).toBe(true);
    const next = applySpellSeedPlans(build, plans, casters);
    expect(next.spellSelections).toEqual(build.spellSelections);
    expect(next.spellLibrary?.wizard?.[1]).toEqual(["Shield", "Magic Missile"]);
    expect(next.spellLibrary?.wizard?.[2]).toEqual([level2]);
  });

  it("allows preparing newly acquired book spells in the same commit but cannot acquire by preparing", () => {
    const build = character("Wizard");
    build.spellLibrary = { wizard: { 1: ["Shield"] } };
    const casters = derive(build);
    const prepared = {
      classKey: "wizard",
      level: 1,
      mode: "prepared" as const,
      spells: ["Magic Missile", "Magic Missile"],
    };
    expect(() => applySpellSeedPlans(build, [prepared], casters)).toThrow(
      /Acquire/,
    );
    const next = applySpellSeedPlans(
      build,
      [
        prepared,
        {
          classKey: "wizard",
          level: 1,
          mode: "library",
          spells: ["Magic Missile"],
        },
      ],
      casters,
    );
    expect(next.spellSelections?.wizard?.prepared?.[1]).toEqual([
      "Magic Missile",
      "Magic Missile",
    ]);
    expect(next.spellLibrary?.wizard?.[1]).toEqual(["Shield", "Magic Missile"]);
  });

  it("leaves full-list acquisition implicit and preserves repeated daily preparations", () => {
    const build = character("Cleric");
    build.spellSelections = { cleric: { prepared: { 1: ["Bless"] } } };
    const next = applySpellSeedPlans(
      build,
      [{ classKey: "cleric", level: 1, mode: "prepared", spells: ["Bless"] }],
      derive(build),
    );
    expect(next.spellSelections?.cleric?.prepared?.[1]).toEqual([
      "Bless",
      "Bless",
    ]);
    expect(next.spellLibrary).toBeUndefined();
    expect(() =>
      applySpellSeedPlans(
        build,
        [{ classKey: "cleric", level: 1, mode: "library", spells: ["Bless"] }],
        derive(build),
      ),
    ).toThrow(/spellbook/);
  });

  it("rejects locked levels, off-list spells, wrong selection modes and excess preparations", () => {
    const build = character("Wizard"),
      casters = derive(build);
    expect(() =>
      applySpellSeedPlans(
        build,
        [{ classKey: "wizard", level: 9, mode: "library", spells: ["Wish"] }],
        casters,
      ),
    ).toThrow(/unlocked/);
    expect(() =>
      applySpellSeedPlans(
        build,
        [{ classKey: "wizard", level: 1, mode: "library", spells: ["Bless"] }],
        casters,
      ),
    ).toThrow(/available/);
    expect(() =>
      applySpellSeedPlans(
        build,
        [{ classKey: "wizard", level: 1, mode: "known", spells: ["Shield"] }],
        casters,
      ),
    ).toThrow(/mode/);
    expect(() =>
      applySpellSeedPlans(
        build,
        [
          {
            classKey: "wizard",
            level: 1,
            mode: "prepared",
            spells: Array(20).fill("Shield"),
          },
        ],
        casters,
      ),
    ).toThrow(/allowance/);
  });

  it("uses explicit book, known and preparation modes for starting magic", () => {
    const build = character("Wizard");
    build.spellLibrary = { wizard: { 1: ["Shield", "Magic Missile"] } };
    build.spellSelections = { wizard: { prepared: { 1: ["Shield"] } } };
    const plans = buildStartingSpellPlans(build, derive(build));
    expect(plans.map((plan) => plan.mode)).toEqual(["library", "prepared"]);
    const next = applySpellSeedPlans(
      { ...build, spellLibrary: undefined, spellSelections: undefined },
      plans,
      derive(build),
    );
    expect(next.spellLibrary).toEqual(build.spellLibrary);
    expect(next.spellSelections).toEqual(build.spellSelections);
  });
});
