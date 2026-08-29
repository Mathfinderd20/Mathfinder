import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import {
  getSpellEffectByName,
  resolveSpellEffect,
  SPELL_EFFECTS,
} from "../src/content/spell-effects";
import type { CharacterInput, Modifier } from "../src/types";

function baseInput(modifiers: Modifier[] = []): CharacterInput {
  return {
    name: "Spell Test Dummy",
    level: 1,
    size: "medium",
    abilityScores: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    baseAttackBonus: 1,
    baseSaves: { fort: 2, ref: 0, will: 0 },
    baseSpeed: 30,
    modifiers,
  };
}

const testContext = { characterLevel: 10, highestCasterLevel: 10 };

describe("spell effects registry", () => {
  it("covers a broad catalog of tracked spell effects", () => {
    expect(SPELL_EFFECTS.length).toBeGreaterThanOrEqual(35);
    expect(getSpellEffectByName("Heroism")?.id).toBe("spell-heroism");
    expect(getSpellEffectByName("Mirror Image")?.limitations?.[0]).toContain(
      "image count",
    );
  });

  it("looks up spell effects by spell name", () => {
    expect(getSpellEffectByName("Bless")?.id).toBe("spell-bless");
    expect(
      resolveSpellEffect(getSpellEffectByName("Barkskin")!, testContext)
        .modifiers[0]?.type,
    ).toBe("natural-armor");
  });

  it("applies bless, barkskin, and resistance through the shared modifier engine", () => {
    const mods = [
      ...resolveSpellEffect(getSpellEffectByName("Bless")!, testContext)
        .modifiers,
      ...resolveSpellEffect(getSpellEffectByName("Barkskin")!, testContext)
        .modifiers,
      ...resolveSpellEffect(getSpellEffectByName("Resistance")!, testContext)
        .modifiers,
    ];
    const sheet = computeSheet(baseInput(mods));
    expect(sheet.attack.melee.total).toBe(4);
    expect(sheet.attack.ranged.total).toBe(3);
    expect(sheet.ac.normal.total).toBe(15);
    expect(sheet.saves.fort.total).toBe(4);
    expect(sheet.saves.ref.total).toBe(2);
    expect(sheet.saves.will.total).toBe(1);
  });

  it("applies ability, morale, and speed spells to downstream stats", () => {
    const mods = [
      ...resolveSpellEffect(
        getSpellEffectByName("Bull's Strength")!,
        testContext,
      ).modifiers,
      ...resolveSpellEffect(getSpellEffectByName("Heroism")!, testContext)
        .modifiers,
      ...resolveSpellEffect(getSpellEffectByName("Longstrider")!, testContext)
        .modifiers,
    ];
    const sheet = computeSheet(baseInput(mods));
    expect(sheet.abilities.str.score).toBe(18);
    expect(sheet.attack.melee.total).toBe(7);
    expect(sheet.saves.fort.total).toBe(5);
    expect(sheet.speed.total).toBe(40);
  });

  it("applies haste and true strike through the normal modifier engine", () => {
    const mods = [
      ...resolveSpellEffect(getSpellEffectByName("Haste")!, testContext)
        .modifiers,
      ...resolveSpellEffect(getSpellEffectByName("True Strike")!, testContext)
        .modifiers,
    ];
    const sheet = computeSheet(baseInput(mods));
    expect(sheet.attack.melee.total).toBe(24);
    expect(sheet.attack.ranged.total).toBe(23);
    expect(sheet.ac.normal.total).toBe(12);
    expect(sheet.saves.ref.total).toBe(2);
    expect(sheet.speed.total).toBe(60);
  });

  it("spell effect AC bonuses stack according to normal typed rules", () => {
    const mods = [
      ...resolveSpellEffect(getSpellEffectByName("Mage Armor")!, testContext)
        .modifiers,
      ...resolveSpellEffect(
        getSpellEffectByName("Shield of Faith")!,
        testContext,
      ).modifiers,
      ...resolveSpellEffect(getSpellEffectByName("Barkskin")!, testContext)
        .modifiers,
      ...resolveSpellEffect(getSpellEffectByName("Shield")!, testContext)
        .modifiers,
    ];
    const sheet = computeSheet(baseInput(mods));
    expect(sheet.ac.normal.total).toBe(25);
    expect(sheet.ac.touch.total).toBe(13);
    expect(sheet.ac.flatFooted.total).toBe(24);
  });
});
