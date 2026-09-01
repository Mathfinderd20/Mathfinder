import { describe, expect, it } from "vitest";
import type {
  ArchetypeDefinitionLike,
  CharacterBuild,
  ClassFeatureRegistry,
} from "@mathfinder/rules-engine";
import {
  classAbilitiesGrantedAtLevel,
  classLevelAt,
} from "./classAbilityProgression";

const features: ClassFeatureRegistry = {
  infantryman: [
    {
      id: "gunsmith-l1",
      name: "Gunsmith",
      className: "Infantryman",
      level: 1,
      pack: "test",
      description: "Gain Gunsmithing.",
      effects: [],
    },
    {
      id: "gun-training-l5",
      name: "Gun Training",
      className: "Infantryman",
      level: 5,
      pack: "test",
      description: "Choose a firearm.",
      effects: [],
    },
  ],
};

function build(firearmRules?: "guns-everywhere"): CharacterBuild {
  return {
    name: "Planner",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: {
      str: 10,
      dex: 16,
      con: 12,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: Array.from({ length: 5 }, () => ({
      className: "Infantryman",
      hitPointRoll: 10,
    })),
    campaignRules: firearmRules ? { firearmRules } : undefined,
  };
}

describe("class ability progression", () => {
  it("uses class level rather than character level", () => {
    const multiclass = build();
    multiclass.levels.splice(1, 0, { className: "Fighter", hitPointRoll: 10 });
    expect(classLevelAt(multiclass, 2)).toBe(2);
  });

  it("moves Gun Training to level 1 under Guns Everywhere", () => {
    const everywhere = build("guns-everywhere");
    expect(
      classAbilitiesGrantedAtLevel({
        build: everywhere,
        levelIndex: 0,
        classFeatures: features,
        archetypes: {},
      }).map((feature) => feature.name),
    ).toEqual(["Gun Training"]);
    expect(
      classAbilitiesGrantedAtLevel({
        build: everywhere,
        levelIndex: 4,
        classFeatures: features,
        archetypes: {},
      }),
    ).toEqual([]);
  });

  it("shows archetype grants and removes replaced class abilities", () => {
    const target = build();
    target.classArchetypes = { infantryman: ["tester"] };
    const archetypes = {
      tester: {
        id: "tester",
        name: "Tester",
        baseClassName: "Infantryman",
        description: "A test archetype.",
        replaces: ["Gunsmith"],
        features: [
          { level: 1, name: "Replacement Drill", summary: "Test it." },
        ],
      } as ArchetypeDefinitionLike,
    };
    expect(
      classAbilitiesGrantedAtLevel({
        build: target,
        levelIndex: 0,
        classFeatures: features,
        archetypes,
      }).map((feature) => feature.name),
    ).toEqual(["Replacement Drill"]);
  });
});
