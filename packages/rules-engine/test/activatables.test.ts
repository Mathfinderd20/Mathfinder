import { describe, expect, it } from "vitest";
import {
  activatableModifiers,
  activatableRequirementFailure,
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

describe("activatable requirements", () => {
  const deed: ActivatableEffect = {
    id: "dodge",
    name: "Dodge",
    description: "A deed.",
    effects: [],
    requirements: {
      maximumArmorCategory: "medium",
      maximumLoadBand: "medium",
    },
  };

  it("reports armor and load failures", () => {
    expect(
      activatableRequirementFailure(deed, {
        baseAttackBonus: 1,
        characterLevel: 1,
        armorCategory: "heavy",
        loadBand: "light",
      }),
    ).toBe("requires medium armor or lighter");
    expect(
      activatableRequirementFailure(deed, {
        baseAttackBonus: 1,
        characterLevel: 1,
        armorCategory: "light",
        loadBand: "heavy",
      }),
    ).toBe("requires a medium load or lighter");
  });

  it("suppresses an already-selected deed when requirements become illegal", () => {
    const resolved = resolveActivatableSelections({
      available: [deed],
      selected: { dodge: true },
      context: {
        baseAttackBonus: 1,
        characterLevel: 1,
        armorCategory: "heavy",
        loadBand: "light",
      },
    });
    expect(resolved.active).toEqual([]);
    expect(resolved.suppressed.map((effect) => effect.id)).toEqual(["dodge"]);
    expect(resolved.modifiers).toEqual([]);
  });

  it("accepts medium armor and an effectively light ignored load", () => {
    expect(
      activatableRequirementFailure(deed, {
        baseAttackBonus: 1,
        characterLevel: 1,
        armorCategory: "medium",
        loadBand: "light",
      }),
    ).toBeUndefined();
  });
});

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

  it("adds Extra Grit to the pool maximum and calculation", () => {
    const pools = collectResourcePools({
      descriptor: {
        classes: [{ name: "Infantryman", level: 1 }],
        archetypes: [],
        feats: [{ name: "Extra Grit", level: 1 }],
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
      featRegistry: {
        "extra grit": {
          id: "extra-grit",
          name: "Extra Grit",
          pack: "test",
          description: "Gain 2 grit.",
          prerequisites: [],
          effects: [],
          resourcePoolBonuses: [
            {
              poolId: "infantryman-grit",
              value: 2,
              source: "Extra Grit",
            },
          ],
        },
      },
      context: {
        baseAttackBonus: 1,
        characterLevel: 1,
        abilityModifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 0 },
        classLevels: { infantryman: 1 },
      },
    });

    expect(pools[0]).toMatchObject({
      max: 5,
      calculation: {
        rawTotal: 5,
        minimum: 1,
        total: 5,
        contributions: [
          { label: "WIS modifier", value: 3 },
          { label: "Extra Grit", value: 2 },
        ],
      },
    });
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
