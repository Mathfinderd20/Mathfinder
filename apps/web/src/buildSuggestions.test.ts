import { describe, expect, it } from "vitest";
import { buildSuggestions } from "./buildSuggestions";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_BUILD_GUIDES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_SPELLS,
} from "./content";
import {
  FEATS,
  SAMPLE_CLASSES,
  type CharacterBuild,
  type FeatRegistry,
} from "@mathfinder/rules-engine";

const fighter = SAMPLE_CLASSES.fighter!;
const human: CharacterBuild["race"] = {
  name: "Human",
  size: "medium",
  speed: 30,
  abilityModifiers: [],
};
const build: CharacterBuild = {
  name: "Focused suggestions",
  race: human,
  favoredClassName: "Fighter",
  baseAbilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  levels: [{ className: "Fighter", hitPointRoll: fighter.hitDie }],
};

function suggestions(
  plannerLevelIndexes: readonly number[],
  targetBuild: CharacterBuild = build,
  extraFeats: FeatRegistry = {},
) {
  return buildSuggestions({
    build: targetBuild,
    currentLevel: 1,
    sheetSpellcasting: [],
    classes: { ...SAMPLE_CLASSES, ...RUNTIME_CLASSES },
    feats: { ...FEATS, ...RUNTIME_FEATS, ...extraFeats },
    spells: RUNTIME_SPELLS,
    classFeatures: RUNTIME_CLASS_FEATURES,
    archetypes: RUNTIME_ARCHETYPES,
    buildGuides: RUNTIME_BUILD_GUIDES,
    plannerLevelIndexes,
  });
}

describe("focused build suggestions", () => {
  it("only computes requested planner rows", () => {
    const bundle = suggestions([0]);

    expect(bundle.planner[0]?.classChoices.length).toBeGreaterThan(0);
    expect(bundle.planner[1]).toMatchObject({
      classChoices: [],
      featChoices: [],
      favoredClassChoices: [],
    });
  });

  it("uses current weapons and projected stats in feat advice", () => {
    const armedBuild: CharacterBuild = {
      ...build,
      weapons: [
        {
          name: "Greatsword",
          category: "melee",
          damageDice: "2d6",
          handedness: "two",
        },
      ],
    };
    const level = suggestions([0], armedBuild).planner[0]!;
    const powerAttack = level.featChoices.find(
      (choice) => choice.value === "Power Attack",
    );

    expect(powerAttack?.reason).toContain("Strength 16");
    expect(powerAttack?.reason).toContain("two-handed weapon");
    expect(level.notes.some((note) => note.text.includes("Greatsword"))).toBe(
      true,
    );
  });

  it("does not recommend Weapon Finesse without compatible current gear", () => {
    const dexBuild: CharacterBuild = {
      ...build,
      baseAbilityScores: { ...build.baseAbilityScores, str: 10, dex: 18 },
      weapons: [
        {
          name: "Longbow",
          category: "ranged",
          damageDice: "1d8",
        },
      ],
    };

    expect(
      suggestions([0], dexBuild).planner[0]!.featChoices.some(
        (choice) => choice.value === "Weapon Finesse",
      ),
    ).toBe(false);
  });

  it("does not recommend spellcasting-dependent feats to non-casters", () => {
    const spellFeat = {
      id: "overclock-spell",
      name: "Overclock Spell",
      pack: "test",
      description: "When you cast a spell, become implausibly punctual.",
      prerequisites: [],
      tags: ["metamagic"],
      effects: Array.from({ length: 12 }, () => ({
        target: "init" as const,
        type: "untyped" as const,
        value: 1,
        source: "Overclock Spell",
      })),
    };

    expect(
      suggestions([0], build, { [spellFeat.id]: spellFeat }).planner[0]!
        .featChoices,
    ).not.toContainEqual(expect.objectContaining({ value: spellFeat.name }));
  });

  it("can skip planner projections while retaining non-planner suggestions", () => {
    const bundle = suggestions([]);

    expect(bundle.planner).toHaveLength(20);
    expect(
      bundle.planner.every((level) => level.classChoices.length === 0),
    ).toBe(true);
  });
});
