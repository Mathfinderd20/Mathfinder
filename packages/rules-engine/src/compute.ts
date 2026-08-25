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
import { deriveSpellcasting } from "./spellcasting";
import { normalizeAmmoType } from "./runtime";
import type { SpellRegistry } from "./content/spells";
import type {
  BonusType,
  BreakdownEntry,
  ArmorClassContext,
  CharacterInput,
  DerivedDamageReduction,
  DerivedSheet,
  DerivedStat,
  HitPointDetails,
} from "./types";

function sumBreakdown(breakdown: BreakdownEntry[]): number {
  return breakdown.reduce((sum, entry) => sum + entry.value, 0);
}

function deriveAmmoByType(
  items: CharacterInput["inventoryItems"],
): Record<string, number> {
  const ammo: Record<string, number> = {};
  for (const item of items ?? []) {
    const explicitType = item.ammoType?.trim();
    const fallbackName = normalizeAmmoType(item.name);
    const inferredType = explicitType
      ? normalizeAmmoType(explicitType)
      : fallbackName.endsWith("arrow") ||
          fallbackName.endsWith("arrows") ||
          fallbackName.endsWith("bolt") ||
          fallbackName.endsWith("bolts") ||
          fallbackName.endsWith("bullet") ||
          fallbackName.endsWith("bullets")
        ? normalizeAmmoType(fallbackName)
        : "";
    if (!inferredType) continue;
    ammo[inferredType] = (ammo[inferredType] ?? 0) + item.quantity;
  }
  return ammo;
}

function stat(breakdown: BreakdownEntry[]): DerivedStat {
  return { total: sumBreakdown(breakdown), breakdown };
}

function deriveDamageReductions(
  entries: CharacterInput["damageReductions"],
): DerivedDamageReduction[] {
  const grouped = new Map<string, NonNullable<typeof entries>>();
  for (const entry of entries ?? []) {
    if (!Number.isFinite(entry.value) || entry.value <= 0) continue;
    const key = `${entry.appliesAgainst.trim().toLowerCase()}::${entry.bypass.trim().toLowerCase()}`;
    const group = grouped.get(key);
    if (group) group.push(entry);
    else grouped.set(key, [entry]);
  }
  return [...grouped.entries()]
    .map(([id, group]) => {
      const strongest = group.reduce((best, entry) =>
        entry.value > best.value ? entry : best,
      );
      return {
        id,
        label: strongest.label ?? `DR vs ${strongest.appliesAgainst.trim()}`,
        value: strongest.value,
        bypass: strongest.bypass.trim() || "—",
        appliesAgainst: strongest.appliesAgainst.trim(),
        breakdown: [
          {
            source: strongest.source,
            type: "damage-reduction",
            value: strongest.value,
          },
        ],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Compute a complete derived character sheet from base data + a flat modifier
 * stream. Deterministic and side-effect free: identical inputs always yield
 * identical output, so it can run on device AND on the server.
 */
export interface ComputeSheetOptions {
  spellRegistry?: SpellRegistry;
}

export function computeSheet(
  input: CharacterInput,
  options: ComputeSheetOptions = {},
): DerivedSheet {
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
  const baseAcModifiers = modifiersFor(input.modifiers, "ac");
  const acMods = resolveModifiers(baseAcModifiers);

  const buildAc = (
    opts: {
      includeDex: boolean;
      excludeTypes: ReadonlySet<BonusType>;
    },
    modifiers = baseAcModifiers,
    explicitTargetPrefix?: string,
  ): DerivedStat => {
    const breakdown: BreakdownEntry[] = [
      { source: "base", type: "base", value: 10 },
    ];
    if (sizeAcAttack !== 0) {
      breakdown.push({
        source: `size (${input.size})`,
        type: "size",
        value: sizeAcAttack,
      });
    }
    if (opts.includeDex && dexToAc !== 0) {
      breakdown.push({ source: "Dexterity", type: "dex", value: dexToAc });
    }
    const eligibleModifiers = modifiers.filter(
      (modifier) =>
        !opts.excludeTypes.has(modifier.type) ||
        (!!explicitTargetPrefix &&
          modifier.target.startsWith(explicitTargetPrefix)),
    );
    for (const m of resolveModifiers(eligibleModifiers).contributing) {
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }
    return stat(breakdown);
  };

  const acContextDefinitions: Array<{
    context: ArmorClassContext;
    label: string;
    inheritedContexts: ArmorClassContext[];
  }> = [
    {
      context: "firearms",
      label: "vs Firearms",
      inheritedContexts: ["ranged", "firearms"],
    },
    { context: "ranged", label: "vs Ranged", inheritedContexts: ["ranged"] },
    { context: "melee", label: "vs Melee", inheritedContexts: ["melee"] },
  ];
  const contextual = acContextDefinitions.flatMap((definition) => {
    const ownTargetSuffix = `.vs.${definition.context}`;
    const contextualModifiers = input.modifiers.filter((modifier) => {
      if (modifier.enabled === false) return false;
      return definition.inheritedContexts.some(
        (context) =>
          modifier.target === `ac.vs.${context}` ||
          modifier.target === `ac.touch.vs.${context}`,
      );
    });
    if (
      !contextualModifiers.some((modifier) =>
        modifier.target.endsWith(ownTargetSuffix),
      )
    )
      return [];
    const commonModifiers = contextualModifiers.filter((modifier) =>
      modifier.target.startsWith("ac.vs."),
    );
    const touchModifiers = contextualModifiers.filter((modifier) =>
      modifier.target.startsWith("ac.touch.vs."),
    );
    const combinedModifiers = [...baseAcModifiers, ...commonModifiers];
    return [
      {
        context: definition.context,
        label: definition.label,
        normal: buildAc(
          { includeDex: true, excludeTypes: new Set() },
          combinedModifiers,
        ),
        touch: buildAc(
          { includeDex: true, excludeTypes: TOUCH_EXCLUDED_AC_TYPES },
          [...combinedModifiers, ...touchModifiers],
          "ac.touch.",
        ),
        flatFooted: buildAc(
          {
            includeDex: false,
            excludeTypes: FLAT_FOOTED_EXCLUDED_AC_TYPES,
          },
          combinedModifiers,
        ),
      },
    ];
  });

  const ac = {
    normal: buildAc({ includeDex: true, excludeTypes: new Set() }),
    touch: buildAc({ includeDex: true, excludeTypes: TOUCH_EXCLUDED_AC_TYPES }),
    flatFooted: buildAc({
      includeDex: false,
      excludeTypes: FLAT_FOOTED_EXCLUDED_AC_TYPES,
    }),
    contextual,
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
    for (const m of resolveModifiers(modifiersFor(input.modifiers, target))
      .contributing) {
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
  for (const m of resolveModifiers(modifiersFor(input.modifiers, "init"))
    .contributing) {
    initBreakdown.push({ source: m.source, type: m.type, value: m.value });
  }
  const initiative = stat(initBreakdown);

  // ---- CMB / CMD ---------------------------------------------------------
  const cmbBreakdown: BreakdownEntry[] = [
    { source: "BAB", type: "base", value: bab },
    { source: "Strength", type: "ability", value: strMod },
  ];
  if (sizeCmbCmd !== 0) {
    cmbBreakdown.push({
      source: `size (${input.size})`,
      type: "size",
      value: sizeCmbCmd,
    });
  }
  for (const m of resolveModifiers(modifiersFor(input.modifiers, "cmb"))
    .contributing) {
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
    cmdBreakdown.push({
      source: `size (${input.size})`,
      type: "size",
      value: sizeCmbCmd,
    });
  }
  // Dodge/deflection/etc. bonuses to AC also improve CMD.
  for (const m of acMods.contributing) {
    if (CMD_RELEVANT_AC_TYPES.has(m.type)) {
      cmdBreakdown.push({ source: m.source, type: m.type, value: m.value });
    }
  }
  for (const m of resolveModifiers(modifiersFor(input.modifiers, "cmd"))
    .contributing) {
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
      breakdown.push({
        source: `size (${input.size})`,
        type: "size",
        value: sizeAcAttack,
      });
    }
    for (const m of resolveModifiers(modifiersFor(input.modifiers, target))
      .contributing) {
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
  const hpModifierContributions = resolveModifiers(
    modifiersFor(input.modifiers, "hp"),
  ).contributing;
  const hitPointDetails: HitPointDetails = {
    dice: input.hitPointDetails?.dice ?? [],
    rolledHpTotal:
      input.hitPointDetails?.rolledHpTotal ??
      (input.rolledHitPoints ?? []).reduce((sum, value) => sum + value, 0),
    constitutionBonusTotal: (input.rolledHitPoints ?? []).reduce(
      (sum, value) => sum + Math.max(1, value + conMod) - value,
      0,
    ),
    favoredClassHpTotal: hpModifierContributions
      .filter((modifier) => modifier.source === "Favored class")
      .reduce((sum, modifier) => sum + modifier.value, 0),
    miscHpTotal: hpModifierContributions
      .filter((modifier) => modifier.source !== "Favored class")
      .reduce((sum, modifier) => sum + modifier.value, 0),
  };
  const speed = deriveSpeed(input);
  const skills = deriveSkills(input, abilities);
  const ammoByType = deriveAmmoByType(input.inventoryItems);
  const weapons = deriveWeapons({
    weapons: input.weapons ?? [],
    ammoAvailabilityByWeapon: Object.fromEntries(
      (input.weapons ?? []).map((weapon) => {
        const weaponKey = `${weapon.weaponTemplateId?.toLowerCase() ?? weapon.name.toLowerCase()}::${weapon.sourceKind ?? "custom"}::${weapon.sourceIndex ?? -1}`;
        const ammoConsumptions =
          weapon.ammoConsumptions && weapon.ammoConsumptions.length > 0
            ? weapon.ammoConsumptions
            : weapon.ammoType && (weapon.ammoPerAttack ?? 0) > 0
              ? [
                  {
                    ammoType: weapon.ammoType,
                    amount: weapon.ammoPerAttack ?? 1,
                  },
                ]
              : [];
        const availability = ammoConsumptions
          .filter((entry) => entry.amount > 0)
          .map((entry) => ({
            ammoType: normalizeAmmoType(entry.ammoType),
            amount: entry.amount,
            available: ammoByType[normalizeAmmoType(entry.ammoType)] ?? 0,
          }));
        return [weaponKey, availability] as const;
      }),
    ),
    abilityMods: {
      str: abilities.str.mod,
      dex: abilities.dex.mod,
      con: abilities.con.mod,
      int: abilities.int.mod,
      wis: abilities.wis.mod,
      cha: abilities.cha.mod,
    },
    meleeAttack: attack.melee,
    rangedAttack: attack.ranged,
    modifiers: input.modifiers,
    weaponDamageAbilityOverrides: input.weaponDamageAbilityOverrides,
  });
  const spellcasting = deriveSpellcasting(
    input,
    abilities,
    options.spellRegistry,
  );

  return {
    raceMetadata: input.raceMetadata,
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
    hitPointDetails,
    speed,
    skills,
    weapons,
    encumbrance: deriveEncumbrance(
      strScore,
      input.carriedWeight ?? 0,
      input.ignoreEncumbrance,
    ),
    inventory: input.inventory ?? {
      itemCount: 0,
      equippedCount: 0,
      totalWeight: 0,
      totalCostGp: 0,
    },
    inventoryItems: input.inventoryItems ?? [],
    rangedCombat: { ammoByType },
    spellcasting,
    damageReductions: deriveDamageReductions(input.damageReductions),
    descriptor: input.descriptor ?? {
      classes: [],
      archetypes: [],
      feats: [],
      features: [],
      suppressedFeatures: [],
    },
  };
}

export { abilityModifier };
