import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "../src/build/types";
import { deriveDeathRules } from "../src/death-rules";

function build(partial: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    name: "Survivor",
    race: {
      name: "Half-Orc",
      size: "medium",
      ferocity: "half-orc",
      favoredClassBonuses: [
        {
          id: "orc-fighter-death-threshold",
          className: "Fighter",
          label: "Orc resilience",
          description: "Death threshold",
          deathThresholdBonus: 2,
        },
      ],
    },
    favoredClassName: "Fighter",
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 14,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: [
      {
        className: "Fighter",
        hitPointRoll: 10,
        feats: ["Endurance", "Diehard"],
        favoredClass: "orc-fighter-death-threshold",
      },
    ],
    ...partial,
  };
}

describe("death rules", () => {
  it("derives Diehard and accumulates racial Fighter death-threshold FCBs", () => {
    const rules = deriveDeathRules({
      ...build(),
      levels: [
        ...build().levels,
        {
          className: "Fighter",
          hitPointRoll: 6,
          favoredClass: "orc-fighter-death-threshold",
        },
      ],
    });

    expect(rules.hasDiehard).toBe(true);
    expect(rules.automaticallyStabilizes).toBe(true);
    expect(rules.ferocity).toBe("half-orc");
    expect(rules.deathThresholdBonus).toBe(4);
  });

  it("removes Half-Orc ferocity when an alternate trait replaces it", () => {
    const rules = deriveDeathRules({
      ...build(),
      race: {
        ...build().race,
        choiceSelection: { alternateTraits: ["sacred-tattoo"] },
        alternateTraits: [
          {
            id: "sacred-tattoo",
            name: "Sacred Tattoo",
            description: "Replacement",
            replaces: ["Orc Ferocity"],
          },
        ],
      },
    });

    expect(rules.ferocity).toBeUndefined();
  });
});
