import { describe, expect, it } from "vitest";
import { createFreshCharacterBuild } from "./newCharacterBuild";

const humanRace = {
  id: "human",
  name: "Human",
  size: "medium" as const,
  speed: 30,
  abilityModifiers: [],
  choiceOptions: { flexibleAbilityBonus: { value: 2 } },
};

describe("createFreshCharacterBuild", () => {
  it("creates a clean level-one build without sample gear", () => {
    const build = createFreshCharacterBuild("  Merisiel  ", humanRace);

    expect(build.name).toBe("Merisiel");
    expect(build.race.name).toBe("Human");
    expect(build.levels).toHaveLength(1);
    expect(build.levels[0]?.className).toBe("Fighter");
    expect(build.levels[0]?.feats).toEqual([]);
    expect(build.weapons).toEqual([]);
    expect(build.equipment).toEqual([]);
    expect(build.coinPurse).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });
});
