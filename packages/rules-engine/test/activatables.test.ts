import { describe, expect, it } from "vitest";
import {
  activatableModifiers,
  babStep,
  collectResourcePools,
  groupActivatables,
  resourcePoolMaximum,
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

describe("resource pools", () => {
  it("derives serializable ability- and class-scaled maximums", () => {
    expect(
      resourcePoolMaximum(
        {
          id: "ki",
          name: "Ki",
          unit: "points",
          description: "A test pool.",
          maximum: {
            base: 1,
            ability: "wis",
            className: "monk",
            classLevelMultiplier: 0.5,
            minimum: 1,
          },
        },
        {
          baseAttackBonus: 4,
          characterLevel: 6,
          abilityModifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 0 },
          classLevels: { monk: 6 },
        },
      ),
    ).toBe(7);
  });

  it("collects a granted class pool without requiring an activatable toggle", () => {
    const pools = collectResourcePools({
      descriptor: {
        classes: [{ name: "Infantryman", level: 1 }],
        archetypes: [],
        feats: [],
        features: [{ name: "Grit", level: 1 }],
        suppressedFeatures: [],
      },
      classFeatureRegistry: {
        infantryman: [
          {
            id: "grit-feature",
            name: "Grit",
            className: "infantryman",
            level: 1,
            pack: "test",
            description: "Gain grit.",
            effects: [],
            resourcePool: {
              id: "infantryman-grit",
              name: "Grit",
              unit: "grit",
              description: "Spend grit on deeds.",
              maximum: { ability: "wis", minimum: 1 },
            },
          },
        ],
      },
      featRegistry: {},
      context: {
        baseAttackBonus: 1,
        characterLevel: 1,
        abilityModifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 0 },
        classLevels: { infantryman: 1 },
      },
    });
    expect(pools).toEqual([
      expect.objectContaining({ id: "infantryman-grit", name: "Grit", max: 3 }),
    ]);
  });

  it("enforces the grit minimum when Wisdom is low", () => {
    expect(
      resourcePoolMaximum(
        {
          id: "grit",
          name: "Grit",
          unit: "grit",
          description: "A test pool.",
          maximum: { ability: "wis", minimum: 1 },
        },
        {
          baseAttackBonus: 1,
          characterLevel: 1,
          abilityModifiers: { str: 0, dex: 0, con: 0, int: 0, wis: -2, cha: 0 },
        },
      ),
    ).toBe(1);
  });
});

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
