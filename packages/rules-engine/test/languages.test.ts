import { expect, it } from "vitest";
import {
  CANONICAL_LANGUAGES,
  SELECTABLE_CANONICAL_LANGUAGES,
  deriveLanguages,
  uniqueLanguages,
  type CharacterBuild,
} from "../src";
const build: CharacterBuild = {
  name: "Linguist",
  race: {
    name: "Elf",
    size: "medium",
    abilityModifiers: [
      { source: "Elf", target: "int", type: "racial", value: 2 },
    ],
  },
  baseAbilityScores: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
  levels: [
    { className: "Wizard", hitPointRoll: 6, skillRanks: { linguistics: 1 } },
  ],
};
it("uses Codex language metadata and respects replaced racial grants", () => {
  expect(
    deriveLanguages({
      ...build,
      race: {
        name: "Custom ancestry",
        size: "medium",
        languageRules: { automatic: ["Aklo"], perLinguisticsRank: 2 },
      },
    }),
  ).toMatchObject({ automatic: ["Aklo"], learnedCapacity: 2 });
  expect(
    deriveLanguages({
      ...build,
      race: {
        name: "Tengu",
        size: "medium",
        alternateTraits: [
          {
            id: "swap",
            name: "Alternate",
            description: "",
            replaces: ["Gifted Linguist"],
          },
        ],
        choiceSelection: { alternateTraits: ["swap"] },
      },
    }).learnedCapacity,
  ).toBe(1);
});
it("derives ancestry, creation INT, ranks, and explicit extras without temporary bonuses", () => {
  expect(
    deriveLanguages({
      ...build,
      otherModifiers: [
        {
          source: "Fox's Cunning",
          target: "int",
          type: "enhancement",
          value: 4,
        },
      ],
      languages: {
        starting: ["Draconic"],
        learned: ["Goblin"],
        additional: ["Aklo"],
      },
    }),
  ).toMatchObject({
    automatic: ["Common", "Elven"],
    startingCapacity: 3,
    learnedCapacity: 1,
    all: ["Common", "Elven", "Draconic", "Goblin", "Aklo"],
  });
});
it("uses applied ranks, not skill modifiers or future levels", () => {
  const planned = {
    ...build,
    levels: [
      ...build.levels,
      { className: "Wizard", hitPointRoll: 4, skillRanks: { linguistics: 1 } },
    ],
  };
  expect(deriveLanguages(planned).learnedCapacity).toBe(2);
  expect(
    deriveLanguages({ ...planned, levels: planned.levels.slice(0, 1) })
      .learnedCapacity,
  ).toBe(1);
});
it("supports alternate racial language grants and Cosmopolitan", () => {
  expect(
    deriveLanguages({
      ...build,
      race: {
        ...build.race,
        alternateTraits: [
          { id: "gift", name: "Gift of Tongues", description: "" },
        ],
        choiceSelection: {
          alternateTraits: ["gift"],
          bonusFeat: "Cosmopolitan",
        },
      },
    }).learnedCapacity,
  ).toBe(4);
  expect(uniqueLanguages([" Common ", "Common", "", "Elven"])).toEqual([
    "Common",
    "Elven",
  ]);
});
it("publishes the canonical language choices while reserving Druidic", () => {
  expect(CANONICAL_LANGUAGES).toContain("Common");
  expect(CANONICAL_LANGUAGES).toContain("Druidic");
  expect(SELECTABLE_CANONICAL_LANGUAGES).not.toContain("Druidic");
  expect(new Set(CANONICAL_LANGUAGES).size).toBe(CANONICAL_LANGUAGES.length);
});
