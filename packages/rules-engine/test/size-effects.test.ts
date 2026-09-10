import { describe, expect, it } from "vitest";
import { resizePersonWeaponDice } from "../src/size-effects";
import {
  computeSheet,
  getSpellEffectByName,
  resolveSpellEffect,
  createRuntimeStateSnapshot,
  reduceRuntimeState,
  type CharacterInput,
  type Size,
} from "../src";

const base: CharacterInput = {
  name: "Size fixture",
  level: 5,
  size: "medium",
  abilityScores: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
  baseAttackBonus: 5,
  baseSaves: { fort: 0, ref: 0, will: 0 },
  modifiers: [],
  weapons: [
    {
      name: "Sword",
      category: "melee",
      damageDice: "1d8",
      damageTypes: ["slashing"],
    },
    { name: "Bow", category: "ranged", damageDice: "1d8", ammoType: "arrows" },
    {
      name: "Javelin",
      category: "ranged",
      damageDice: "1d6",
      damageAbility: "str",
    },
  ],
};
function effect(name: string) {
  return resolveSpellEffect(getSpellEffectByName(name)!, {
    characterLevel: 5,
    highestCasterLevel: 5,
  }).modifiers;
}
describe("Person size effects in the shared rules engine", () => {
  it("can expend a cast without enabling an effect on an unselected caster", () => {
    const next = reduceRuntimeState(createRuntimeStateSnapshot(), {
      type: "cast-spell",
      classKey: "wizard",
      level: 1,
      max: 3,
      remaining: 3,
      spellName: "Enlarge Person",
    });
    expect(next.toggles).toEqual({});
    expect(next.slotUsage.wizard?.[1]).toBe(1);
  });
  it("uses starting size to choose one or two damage-chart steps", () => {
    expect(resizePersonWeaponDice("1d8", "small", 1)).toBe("1d10");
    expect(resizePersonWeaponDice("1d8", "medium", 1)).toBe("2d6");
    expect(resizePersonWeaponDice("2d6", "large", -1)).toBe("1d8");
    expect(resizePersonWeaponDice("2d6", "medium", -1)).toBe("1d10");
    expect(resizePersonWeaponDice("1d12", "medium", 1)).toBe("3d6");
  });
  it("casting the opposite spell dispels the old effect and still expends the slot", () => {
    const state = createRuntimeStateSnapshot({
      toggles: { "spell-enlarge-person": true },
    });
    const next = reduceRuntimeState(state, {
      type: "cast-spell",
      classKey: "wizard",
      level: 1,
      max: 3,
      remaining: 3,
      spellName: "Reduce Person",
      spellEffectId: "spell-reduce-person",
    });
    expect(next.toggles["spell-enlarge-person"]).toBe(false);
    expect(next.toggles["spell-reduce-person"]).toBe(false);
    expect(next.slotUsage.wizard?.[1]).toBe(1);
  });
  it("uses Dexterity for maneuvers when Reduce makes a Small creature Tiny", () => {
    const tiny = computeSheet({
      ...base,
      size: "small",
      modifiers: effect("Reduce Person"),
    });
    expect(tiny.size).toBe("tiny");
    expect(tiny.cmb.breakdown).toContainEqual({
      source: "Dexterity",
      type: "ability",
      value: 3,
    });
  });
  it("derives size, abilities, AC, attack, maneuvers and damage without mutating the build", () => {
    const normal = computeSheet(base);
    const enlarged = computeSheet({
      ...base,
      modifiers: effect("Enlarge Person"),
    });
    expect(enlarged.size).toBe("large");
    expect(enlarged.abilities.str.score).toBe(18);
    expect(enlarged.abilities.dex.score).toBe(12);
    expect(enlarged.ac.normal.total).toBe(normal.ac.normal.total - 2);
    expect(enlarged.attack.melee.total).toBe(normal.attack.melee.total);
    expect(enlarged.attack.ranged.total).toBe(normal.attack.ranged.total - 2);
    expect(enlarged.cmb.total).toBe(normal.cmb.total + 2);
    expect(enlarged.cmd.total).toBe(normal.cmd.total + 1);
    expect(enlarged.weapons.map((weapon) => weapon.damageDice)).toEqual([
      "2d6",
      "1d8",
      "1d6",
    ]);
    expect(enlarged.skills.stealth!.total).toBe(
      normal.skills.stealth!.total - 5,
    );
    expect(enlarged.speed.total).toBe(normal.speed.total);
    expect(base.size).toBe("medium");
    expect(base.weapons![0]!.damageDice).toBe("1d8");
    expect(computeSheet(base)).toEqual(normal);
  });
  it("shrinks melee and projectiles but not thrown weapons, with ability floors", () => {
    const reduced = computeSheet({
      ...base,
      modifiers: effect("Reduce Person"),
    });
    expect(reduced.size).toBe("small");
    expect(reduced.abilities.str.score).toBe(14);
    expect(reduced.ac.normal.total).toBe(14);
    expect(reduced.weapons.map((weapon) => weapon.damageDice)).toEqual([
      "1d6",
      "1d6",
      "1d6",
    ]);
    expect(
      computeSheet({
        ...base,
        abilityScores: { ...base.abilityScores, str: 2 },
        modifiers: effect("Reduce Person"),
      }).abilities.str.score,
    ).toBe(1);
  });
  it.each([
    ["small", "medium"],
    ["large", "huge"],
    ["colossal", "colossal"],
  ])("uses the actual base size %s", (size, expected) => {
    expect(
      computeSheet({
        ...base,
        size: size as Size,
        modifiers: effect("Enlarge Person"),
      }).size,
    ).toBe(expected);
  });
  it("does not stack duplicate or disabled size effects", () => {
    const modifiers = effect("Enlarge Person");
    expect(
      computeSheet({ ...base, modifiers: [...modifiers, ...modifiers] }).size,
    ).toBe("large");
    expect(
      computeSheet({
        ...base,
        modifiers: modifiers.map((modifier) => ({
          ...modifier,
          enabled: false,
        })),
      }).size,
    ).toBe("medium");
    expect(
      computeSheet({
        ...base,
        modifiers: [...modifiers, ...effect("Reduce Person")],
      }),
    ).toEqual(computeSheet(base));
  });
  it.each([
    ["spell-enlarge-person", "spell-reduce-person"],
    ["spell-reduce-person", "spell-enlarge-person"],
  ])("counterspells %s with %s atomically", (first, second) => {
    const state = reduceRuntimeState(createRuntimeStateSnapshot(), {
      type: "set-toggle",
      id: first,
      value: true,
    });
    const next = reduceRuntimeState(state, {
      type: "set-toggle",
      id: second,
      value: true,
    });
    expect(next.toggles[first]).toBe(false);
    expect(next.toggles[second]).toBe(false);
  });
});
