import { useMemo } from "react";
import {
  activatableResourceMax,
  buildCharacter,
  collectActivatableEffects,
  collectResourcePools,
  computeSheet,
  groupActivatables,
  resolveActivatableSelections,
  type AbilityKey,
  type ActivationContext,
  type CharacterBuild,
  type Modifier,
  type SpellEffectRuntimeContext,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_SPELLS,
} from "../content";
import { buildRuntimeBuffs } from "../data";

export function useDerivedSheet(args: {
  build: CharacterBuild;
  activeBuffs: Record<string, boolean>;
  fatigued: boolean;
  spellSlotUsage: Record<string, Partial<Record<number, number>>>;
}) {
  const { build, activeBuffs, fatigued, spellSlotUsage } = args;
  return useMemo(() => {
    const input = buildCharacter(
      {
        ...build,
        conditions: fatigued ? ["fatigued"] : [],
        spellSlotUsage,
      },
      RUNTIME_CLASSES,
      RUNTIME_FEATS,
      RUNTIME_CLASS_FEATURES,
      RUNTIME_ARCHETYPES,
    );
    const baseSheet = computeSheet(input, { spellRegistry: RUNTIME_SPELLS });
    const activatableFeatures = collectActivatableEffects({
      descriptor: baseSheet.descriptor,
      classFeatureRegistry: RUNTIME_CLASS_FEATURES,
      featRegistry: RUNTIME_FEATS,
    });
    const abilityModifiers = Object.fromEntries(
      (["str", "dex", "con", "int", "wis", "cha"] as AbilityKey[]).map(
        (key) => [key, baseSheet.abilities[key].mod],
      ),
    ) as Record<AbilityKey, number>;
    const activationContext: ActivationContext = {
      baseAttackBonus: baseSheet.baseAttackBonus,
      characterLevel: baseSheet.level,
      abilityModifiers,
      classLevels: Object.fromEntries(
        baseSheet.descriptor.classes.map((entry) => [
          entry.name.toLowerCase(),
          entry.level,
        ]),
      ),
    };
    const spellEffectContext: SpellEffectRuntimeContext = {
      characterLevel: baseSheet.level,
      highestCasterLevel: Math.max(
        0,
        ...baseSheet.spellcasting.map((entry) => entry.casterLevel),
      ),
    };
    const runtimeBuffs = buildRuntimeBuffs(spellEffectContext);
    const resourcePools = collectResourcePools({
      descriptor: baseSheet.descriptor,
      classFeatureRegistry: RUNTIME_CLASS_FEATURES,
      featRegistry: RUNTIME_FEATS,
      context: activationContext,
    });
    const resourceMaxes: Record<string, number> = {};
    const resourceLabels: Record<string, string> = {};
    for (const feature of activatableFeatures) {
      const max = activatableResourceMax(feature, activationContext);
      if (max !== undefined) resourceMaxes[feature.id] = max;
    }
    for (const pool of resourcePools) {
      resourceMaxes[pool.id] = pool.max;
      resourceLabels[pool.id] = pool.unit;
    }
    for (const buff of runtimeBuffs) {
      if (buff.trackerMax !== undefined)
        resourceMaxes[buff.id] = buff.trackerMax;
      if (buff.trackerLabel) resourceLabels[buff.id] = buff.trackerLabel;
    }
    const resolvedActivatables = resolveActivatableSelections({
      available: activatableFeatures,
      selected: activeBuffs,
      context: activationContext,
    });
    const classAbilityModifiers: Modifier[] = resolvedActivatables.modifiers;
    const buffModifiers: Modifier[] = runtimeBuffs
      .filter((buff) => activeBuffs[buff.id])
      .flatMap((buff) => buff.modifiers);
    const withBuffs = {
      ...input,
      modifiers: [
        ...input.modifiers,
        ...classAbilityModifiers,
        ...buffModifiers,
      ],
    };
    return {
      sheet: computeSheet(withBuffs, { spellRegistry: RUNTIME_SPELLS }),
      activatableGroups: groupActivatables(activatableFeatures),
      activatableConflicts: resolvedActivatables.conflicts,
      resourceMaxes,
      resourceLabels,
      resourcePools,
      runtimeBuffs,
      spellEffectContext,
    };
  }, [build, activeBuffs, fatigued, spellSlotUsage]);
}
