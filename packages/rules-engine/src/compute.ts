import { abilityModifier, deriveAbilities } from "./abilities";
import {
  CMD_RELEVANT_AC_TYPES,
  FLAT_FOOTED_EXCLUDED_AC_TYPES,
  SIZE_AC_ATTACK_MOD,
  SIZE_CMB_CMD_MOD,
  TOUCH_EXCLUDED_AC_TYPES,
} from "./constants";
import { modifiersFor, resolveModifiers } from "./modifiers";
import { deriveSkills } from "./skills";
import { deriveHitPoints, deriveSpeed } from "./vitals";
import { deriveWeapons } from "./weapons";
import { deriveEncumbrance } from "./encumbrance";
import type {
  BonusType,
  BreakdownEntry,
  CharacterInput,
  DerivedSheet,
  DerivedStat,
} from "./types";

function sumBreakdown(breakdown: BreakdownEntry[]): number {
  return breakdown.reduce((sum, entry) => sum + entry.value, 0);
}

function stat(breakdown: BreakdownEntry[]): DerivedStat {
  return { total: sumBreakdown(breakdown), breakdown };
}

/**
 * Compute a complete derived character sheet from base data + a flat modifier
 * stream. Deterministic and side-effect free: identical inputs always yield
 * identical output, so it can run on device AND on the server.
 */
export function computeSheet(input: CharacterInput): DerivedSheet {
  const abilities = deriveAbilities(input);
  const strScore = abilities.str.score;
  const strMod = abilities.str.mod;
  const dexMod = abilities.dex.mod;
  const conMod = abilities.con.mod;
  const wisMod = abilities.wis.mod;

  const bab = input.baseAttackBonus;
  const sizeAcAttack = SIZE_AC_ATTACK_MOD[input.size];
  const sizeCmbCmd = SIZE_CMB_CMD_MOD[input.size];

  // Dex bonus to AC is capped by armor; penalties always apply in full.
  const maxDex = input.maxDexBonus ?? Number.POSITIVE_INFINITY;
  const dexToAc = dexMod < 0 ? dexMod : Math.min(dexMod, maxDex);

  // ---- Armor Class -------------------------------------------------------
  const acMods = resolveModifiers(modifiersFor(input.modifiers, "ac"));

  const buildAc = (opts: {
    includeDex: boolean;
    excludeTypes: ReadonlySet<BonusType>;
  }): DerivedStat => {
    const breakdown: BreakdownEntry[] = [
      { source: "base", type: "base", value: 10 },
    ];
    if (sizeAcAttack !== 0) {
      breakdown.push({ source: `size (${input.size})`, type: "size", value: sizeAcAttack });
    }
    if (opts.includeDex && dexToAc !== 0) {
      breakdown.push({ source: "Dexterity", type: "dex", value: dexToAc });
    }
    for (const m of acMods.contributing) {
      if (opts.excludeTypes.has(m.type)) continue;
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }
    return stat(breakdown);
  };

  const ac = {
    normal: buildAc({ includeDex: true, excludeTypes: new Set() }),
    touch: buildAc({ includeDex: true, excludeTypes: TOUCH_EXCLUDED_AC_TYPES }),
    flatFooted: buildAc({ includeDex: false, excludeTypes: FLAT_FOOTED_EXCLUDED_AC_TYPES }),
  };

  // ---- Saving throws -----------------------------------------------------
  const save = (
    base: number,
    abilityMod: number,
    abilityLabel: string,
    target: "save.fort" | "save.ref" | "save.will",
  ): DerivedStat => {
    const breakdown: BreakdownEntry[] = [
      { source: "base save", type: "base", value: base },
      { source: abilityLabel, type: "ability", value: abilityMod },
    ];
    for (const m of resolveModifiers(modifiersFor(input.modifiers, target)).contributing) {
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }
    return stat(breakdown);
  };

  const saves = {
    fort: save(input.baseSaves.fort, conMod, "Constitution", "save.fort"),
    ref: save(input.baseSaves.ref, dexMod, "Dexterity", "save.ref"),
    will: save(input.baseSaves.will, wisMod, "Wisdom", "save.will"),
  };

  // ---- Initiative --------------------------------------------------------
  const initBreakdown: BreakdownEntry[] = [
    { source: "Dexterity", type: "ability", value: dexMod },
  ];
  for (const m of resolveModifiers(modifiersFor(input.modifiers, "init")).contributing) {
    initBreakdown.push({ source: m.source, type: m.type, value: m.value });
  }
  const initiative = stat(initBreakdown);

  // ---- CMB / CMD ---------------------------------------------------------
  const cmbBreakdown: BreakdownEntry[] = [
    { source: "BAB", type: "base", value: bab },
    { source: "Strength", type: "ability", value: strMod },
  ];
  if (sizeCmbCmd !== 0) {
    cmbBreakdown.push({ source: `size (${input.size})`, type: "size", value: sizeCmbCmd });
  }
  for (const m of resolveModifiers(modifiersFor(input.modifiers, "cmb")).contributing) {
    cmbBreakdown.push({ source: m.source, type: m.type, value: m.value });
  }
  const cmb = stat(cmbBreakdown);

  const cmdBreakdown: BreakdownEntry[] = [
    { source: "base", type: "base", value: 10 },
    { source: "BAB", type: "base", value: bab },
    { source: "Strength", type: "ability", value: strMod },
    { source: "Dexterity", type: "ability", value: dexMod },
  ];
  if (sizeCmbCmd !== 0) {
    cmdBreakdown.push({ source: `size (${input.size})`, type: "size", value: sizeCmbCmd });
  }
  // Dodge/deflection/etc. bonuses to AC also improve CMD.
  for (const m of acMods.contributing) {
    if (CMD_RELEVANT_AC_TYPES.has(m.type)) {
      cmdBreakdown.push({ source: m.source, type: m.type, value: m.value });
    }
  }
  for (const m of resolveModifiers(modifiersFor(input.modifiers, "cmd")).contributing) {
    cmdBreakdown.push({ source: m.source, type: m.type, value: m.value });
  }
  const cmd = stat(cmdBreakdown);

  // ---- Attack bonuses ----------------------------------------------------
  const attackBreakdown = (
    abilityMod: number,
    abilityLabel: string,
    target: "attack.melee" | "attack.ranged",
  ): DerivedStat => {
    const breakdown: BreakdownEntry[] = [
      { source: "BAB", type: "base", value: bab },
      { source: abilityLabel, type: "ability", value: abilityMod },
    ];
    if (sizeAcAttack !== 0) {
      breakdown.push({ source: `size (${input.size})`, type: "size", value: sizeAcAttack });
    }
    for (const m of resolveModifiers(modifiersFor(input.modifiers, target)).contributing) {
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }
    return stat(breakdown);
  };

  const attack = {
    melee: attackBreakdown(strMod, "Strength", "attack.melee"),
    ranged: attackBreakdown(dexMod, "Dexterity", "attack.ranged"),
  };

  // ---- Vitals & skills ---------------------------------------------------
  const hitPoints = deriveHitPoints(input, conMod);
  const speed = deriveSpeed(input);
  const skills = deriveSkills(input, abilities);
  const weapons = deriveWeapons({
    weapons: input.weapons,
    strMod,
    meleeAttack: attack.melee,
    rangedAttack: attack.ranged,
    modifiers: input.modifiers,
  });

  return {
    name: input.name,
    level: input.level,
    size: input.size,
    abilities,
    ac,
    saves,
    initiative,
    baseAttackBonus: bab,
    cmb,
    cmd,
    attack,
    hitPoints,
    speed,
    skills,
    weapons,
    encumbrance: deriveEncumbrance(strScore, input.carriedWeight ?? 0),
    descriptor: input.descriptor ?? { classes: [], feats: [], features: [], suppressedFeatures: [] },
  };
}

export { abilityModifier };
