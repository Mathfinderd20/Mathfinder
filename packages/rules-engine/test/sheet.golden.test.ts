import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import { savageBerserkerL1 } from "./fixtures/savage-berserker-l1";

/**
 * Golden test: every derived number is hand-computed from the Pathfinder 1e
 * rules and pinned here. If the engine drifts, this fails loudly.
 *
 * Effective stats for the fixture:
 *   STR 18 (+4, Belt +2), DEX 14 (+2), CON 14 (+2), WIS 12 (+1), CHA 8 (-1)
 *   BAB +1, Medium size, scale mail (maxDex 3) + heavy shield + Dodge.
 */
describe("computeSheet — Savage Company Berserker (L1) golden sheet", () => {
  const sheet = computeSheet(savageBerserkerL1);

  it("derives effective ability scores and modifiers", () => {
    expect(sheet.abilities.str.score).toBe(18);
    expect(sheet.abilities.str.mod).toBe(4);
    expect(sheet.abilities.dex.mod).toBe(2);
    expect(sheet.abilities.con.mod).toBe(2);
    expect(sheet.abilities.wis.mod).toBe(1);
    expect(sheet.abilities.cha.mod).toBe(-1);
  });

  it("computes AC, touch, and flat-footed with the right exclusions", () => {
    // 10 + armor 5 + shield 2 + dex 2 + dodge 1 = 20
    expect(sheet.ac.normal.total).toBe(20);
    // 10 + dex 2 + dodge 1 = 13 (no armor/shield)
    expect(sheet.ac.touch.total).toBe(13);
    // 10 + armor 5 + shield 2 = 17 (no dex, no dodge)
    expect(sheet.ac.flatFooted.total).toBe(17);
  });

  it("applies the Heroism morale bonus to all saves", () => {
    // Fort: base 2 + con 2 + morale 2 = 6
    expect(sheet.saves.fort.total).toBe(6);
    // Ref: base 0 + dex 2 + morale 2 = 4
    expect(sheet.saves.ref.total).toBe(4);
    // Will: base 0 + wis 1 + morale 2 = 3
    expect(sheet.saves.will.total).toBe(3);
  });

  it("computes initiative from Dexterity", () => {
    expect(sheet.initiative.total).toBe(2);
  });

  it("resolves the Bless vs Heroism morale conflict by take-highest on attacks", () => {
    // Melee: BAB 1 + STR 4 + Weapon Focus 1 + morale 2 (Heroism beats Bless) = 8
    expect(sheet.attack.melee.total).toBe(8);
    // Ranged: BAB 1 + DEX 2 + morale 2 = 5
    expect(sheet.attack.ranged.total).toBe(5);
  });

  it("computes CMB and CMD (dodge improves CMD)", () => {
    // CMB: BAB 1 + STR 4 = 5
    expect(sheet.cmb.total).toBe(5);
    // CMD: 10 + BAB 1 + STR 4 + DEX 2 + dodge 1 = 18
    expect(sheet.cmd.total).toBe(18);
  });

  it("computes hit points with the per-die minimum and a flat HP bonus", () => {
    // max(1, 12 + Con 2) = 14, + Toughness 3 = 17
    expect(sheet.hitPoints.total).toBe(17);
  });

  it("applies armor speed reduction", () => {
    // 30 base - 10 (medium armor) = 20
    expect(sheet.speed.total).toBe(20);
  });

  it("computes skills with ranks, class-skill bonus, ability, and armor check penalty", () => {
    // Climb: ranks 1 + STR 4 + class skill 3 - ACP 6 = 2
    expect(sheet.skills.climb.total).toBe(2);
    // Perception: ranks 1 + WIS 1 + class skill 3 = 5 (no ACP)
    expect(sheet.skills.perception.total).toBe(5);
    // Stealth: ranks 1 + DEX 2 + class skill 3 - ACP 6 = 0
    expect(sheet.skills.stealth.total).toBe(0);
    // Intimidate: ranks 1 + CHA -1 + class skill 3 = 3
    expect(sheet.skills.intimidate.total).toBe(3);
  });

  it("does not grant the class-skill bonus without ranks", () => {
    // Swim is a class skill but has 0 ranks: STR 4 - ACP 6 = -2 (no +3)
    expect(sheet.skills.swim.total).toBe(-2);
    expect(sheet.skills.swim.isClassSkill).toBe(true);
  });

  it("applies armor check penalty only to Str/Dex physical skills", () => {
    // Acrobatics: not a class skill, 0 ranks: DEX 2 - ACP 6 = -4
    expect(sheet.skills.acrobatics.total).toBe(-4);
  });

  it("marks trained-only skills as unusable without ranks", () => {
    expect(sheet.skills["disable-device"].usable).toBe(false);
    expect(sheet.skills["knowledge.arcana"].usable).toBe(false);
    // A trained skill the character has ranks in stays usable.
    expect(sheet.skills.stealth.usable).toBe(true);
  });

  it("keeps a human-readable breakdown for the 'why' UX", () => {
    const sources = sheet.ac.normal.breakdown.map((b) => b.source);
    expect(sources).toContain("Scale mail");
    expect(sources).toContain("Dodge");
    expect(sources).toContain("Dexterity");
  });
});
