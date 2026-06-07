import { describe, expect, it } from "vitest";
import {
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
  effects: [{ target: "ac", type: "dodge", value: 1, source: "Combat Expertise" }],
};
const PA: ActivatableEffect = {
  id: "power-attack",
  name: "Power Attack",
  description: "pa",
  group: "attack-mode",
  effects: [{ target: "attack", type: "untyped", value: -1, source: "Power Attack" }],
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
