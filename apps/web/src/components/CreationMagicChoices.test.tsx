import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import {
  creationMagicErrors,
  startingSpellCapacity,
} from "./CreationMagicChoices";

function character(className: string): CharacterBuild {
  return {
    name: "New caster",
    race: { name: "Human", size: "medium" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 16, cha: 16 },
    levels: [{ className, hitPointRoll: 6 }],
  };
}
describe("creation magic requirements", () => {
  it("requires a wizard's starting book instead of confusing it with daily preparation capacity", () => {
    const build = character("Wizard");
    const caster = computeSheet(buildCharacter(build)).spellcasting[0]!;
    expect(startingSpellCapacity(caster, 1)).toBe(6);
    expect(creationMagicErrors(build, [caster])).toContain(
      "Choose 6 level 1 Wizard spells (0 selected).",
    );
  });
  it("uses the spontaneous known-spell allowance, not bonus daily slots", () => {
    const build = character("Sorcerer");
    const caster = computeSheet(buildCharacter(build)).spellcasting[0]!;
    expect(startingSpellCapacity(caster, 0)).toBe(4);
    expect(startingSpellCapacity(caster, 1)).toBe(2);
  });
  it("requires cleric domains while leaving full-list daily preparations for the Magic tab", () => {
    const build = character("Cleric");
    const caster = computeSheet(buildCharacter(build)).spellcasting[0]!;
    expect(creationMagicErrors(build, [caster])).toEqual([
      "Choose two cleric domains.",
    ]);
    build.spellDomains = { cleric: ["good", "healing"] };
    expect(creationMagicErrors(build, [caster])).toEqual([]);
    const druid = character("Druid");
    expect(
      creationMagicErrors(
        druid,
        computeSheet(buildCharacter(druid)).spellcasting,
      ),
    ).toEqual([]);
  });
});
