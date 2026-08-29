import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { levelAfterClassChange } from "./useLevelEditor";

function buildWithFighterBonusFeat(): CharacterBuild {
  return {
    name: "Class Changer",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: [
      { className: "Infantryman", hitPointRoll: 10 },
      {
        className: "Fighter",
        hitPointRoll: 10,
        feats: ["Weapon Focus (Pistol)"],
      },
    ],
  };
}

describe("levelAfterClassChange", () => {
  it("removes a stale fighter bonus feat when the level changes class", () => {
    const changed = levelAfterClassChange(
      buildWithFighterBonusFeat(),
      1,
      "Infantryman",
    );
    expect(changed?.className).toBe("Infantryman");
    expect(changed?.feats).toBeUndefined();
  });
});
