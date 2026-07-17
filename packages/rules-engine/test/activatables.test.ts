import { describe, expect, it } from "vitest";
import {
  activatableModifiers,
  babStep,
  groupActivatables,
  resolveActivatableSelections,
  type ActivatableEffect,
} from "../src/content/activatables";

const RAGE: ActivatableEffect = {
  id: "rage",
  name: "Rage",
  description: "rage",
  effects: [{ target: "str", type: "morale", value: 2, source: "Rage" }],
};
const CE: ActivatableEffect = {
  id: "combat-expertise",
  name: "Combat Expertise",
  description: "ce",
  group: "attack-mode",
  effects: [
    { target: "ac", type: "dodge", value: 1, source: "Combat Expertise" },
  ],
};
const PA: ActivatableEffect = {
  id: "power-attack",
  name: "Power Attack",
  description: "pa",
  group: "attack-mode",
  effects: [
    { target: "attack", type: "untyped", value: -1, source: "Power Attack" },
  ],
};

describe("resolveActivatableSelections", () => {
  it("activates independent toggles normally", () => {
    const resolved = resolveActivatableSelections({
      available: [RAGE],
      selected: { rage: true },
    });
    expect(resolved.active.map((a) => a.id)).toEqual(["rage"]);
    expect(resolved.modifiers).toHaveLength(1);
    expect(resolved.conflicts).toEqual([]);
  });

  it("suppresses extra selections in the same exclusive group", () => {
    const resolved = resolveActivatableSelections({
      available: [CE, PA],
      selected: { "combat-expertise": true, "power-attack": true },
    });
    expect(resolved.active.map((a) => a.id)).toEqual(["combat-expertise"]);
    expect(resolved.suppressed.map((a) => a.id)).toEqual(["power-attack"]);
    expect(resolved.conflicts).toEqual([
      { group: "attack-mode", ids: ["combat-expertise", "power-attack"] },
    ]);
  });
});

describe("scaling activatables", () => {
  const scaled: ActivatableEffect = {
    id: "pa",
    name: "Power Attack",
    description: "",
    effects: [
      {
        target: "attack.melee",
        type: "untyped",
        value: -1,
        source: "Power Attack",
      },
    ],
    scale: (ctx) => [
      {
        target: "attack.melee",
        type: "untyped",
        value: -babStep(ctx.baseAttackBonus),
        source: "Power Attack",
      },
    ],
  };

  it("falls back to static effects without a context", () => {
    expect(activatableModifiers(scaled)[0]!.value).toBe(-1);
  });

  it("scales the penalty by BAB step when a context is given", () => {
    expect(
      activatableModifiers(scaled, {
        baseAttackBonus: 1,
        characterLevel: 1,
      })[0]!.value,
    ).toBe(-1);
    expect(
      activatableModifiers(scaled, {
        baseAttackBonus: 4,
        characterLevel: 4,
      })[0]!.value,
    ).toBe(-2);
    expect(
      activatableModifiers(scaled, {
        baseAttackBonus: 8,
        characterLevel: 8,
      })[0]!.value,
    ).toBe(-3);
  });

  it("resolveActivatableSelections applies scaling through the context", () => {
    const resolved = resolveActivatableSelections({
      available: [scaled],
      selected: { pa: true },
      context: { baseAttackBonus: 8, characterLevel: 8 },
    });
    expect(resolved.modifiers[0]!.value).toBe(-3);
  });
});

describe("groupActivatables", () => {
  it("splits grouped and ungrouped abilities", () => {
    const result = groupActivatables([RAGE, CE, PA]);
    expect(result.ungrouped.map((a) => a.id)).toEqual(["rage"]);
    expect(result.grouped["attack-mode"]?.map((a) => a.id)).toEqual([
      "combat-expertise",
      "power-attack",
    ]);
  });
});
