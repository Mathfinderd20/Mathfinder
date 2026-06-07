import { describe, expect, it } from "vitest";
import { resolveModifiers, modifiersFor } from "../src/modifiers";
import { abilityModifier } from "../src/abilities";
import type { Modifier } from "../src/types";

const m = (
  type: Modifier["type"],
  value: number,
  source = "test",
  target: Modifier["target"] = "ac",
): Modifier => ({ type, value, source, target });

describe("abilityModifier", () => {
  it("matches the Pathfinder table", () => {
    expect(abilityModifier(7)).toBe(-2);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(12)).toBe(1);
    expect(abilityModifier(18)).toBe(4);
    expect(abilityModifier(20)).toBe(5);
  });
});

describe("resolveModifiers stacking rules", () => {
  it("same typed bonus does not stack: take the highest", () => {
    expect(resolveModifiers([m("enhancement", 1), m("enhancement", 2)]).total).toBe(2);
    expect(resolveModifiers([m("competence", 3), m("competence", 2)]).total).toBe(3);
  });

  it("dodge bonuses stack", () => {
    expect(resolveModifiers([m("dodge", 1), m("dodge", 1)]).total).toBe(2);
  });

  it("circumstance bonuses stack", () => {
    expect(resolveModifiers([m("circumstance", 2), m("circumstance", 2)]).total).toBe(4);
  });

  it("untyped bonuses stack", () => {
    expect(resolveModifiers([m("untyped", 1), m("untyped", 1)]).total).toBe(2);
  });

  it("different types stack with each other", () => {
    expect(resolveModifiers([m("enhancement", 2), m("dodge", 1)]).total).toBe(3);
  });

  it("penalties always stack, even same-type", () => {
    expect(resolveModifiers([m("morale", -1), m("morale", -2)]).total).toBe(-3);
  });

  it("a penalty applies alongside the highest same-type bonus", () => {
    // highest enhancement bonus (+3) plus a stacking penalty (-1)
    expect(resolveModifiers([m("enhancement", 3), m("enhancement", -1)]).total).toBe(2);
  });

  it("ignores disabled modifiers", () => {
    const mods = [m("dodge", 1), { ...m("dodge", 5), enabled: false }];
    expect(resolveModifiers(mods).total).toBe(1);
  });

  it("reports only contributing modifiers in the breakdown", () => {
    const resolved = resolveModifiers([
      m("enhancement", 1, "weak"),
      m("enhancement", 2, "strong"),
    ]);
    expect(resolved.contributing.map((c) => c.source)).toEqual(["strong"]);
  });
});

describe("modifiersFor target aliasing", () => {
  it("expands save.all to individual saves", () => {
    const mods: Modifier[] = [
      { type: "morale", value: 2, source: "Heroism", target: "save.all" },
      { type: "resistance", value: 1, source: "Cloak", target: "save.fort" },
    ];
    expect(modifiersFor(mods, "save.fort")).toHaveLength(2);
    expect(modifiersFor(mods, "save.ref")).toHaveLength(1);
  });

  it("expands attack to melee and ranged", () => {
    const mods: Modifier[] = [
      { type: "morale", value: 1, source: "Bless", target: "attack" },
      { type: "untyped", value: 1, source: "Weapon Focus", target: "attack.melee" },
    ];
    expect(modifiersFor(mods, "attack.melee")).toHaveLength(2);
    expect(modifiersFor(mods, "attack.ranged")).toHaveLength(1);
  });
});
