import type { Dispatch, SetStateAction } from "react";
import type {
  AbilityKey,
  Alignment,
  CharacterBuild,
  FirearmRulesMode,
} from "@mathfinder/rules-engine";
import { RUNTIME_ARCHETYPES, RUNTIME_RACES } from "../content";
import {
  materializeRaceChoice,
  syncTemplatedWeaponsToCampaignRules,
} from "./buildNormalization";

export function campaignRulesOrUndefined(
  rules: NonNullable<CharacterBuild["campaignRules"]>,
) {
  return rules.firearmRules ||
    rules.ignoreAlignmentRestrictions ||
    rules.ignoreEncumbrance
    ? rules
    : undefined;
}

export function withFirearmRulesMode(
  current: CharacterBuild["campaignRules"],
  value: FirearmRulesMode,
) {
  const campaignRules = { ...(current ?? {}) };
  if (value === "standard") delete campaignRules.firearmRules;
  else campaignRules.firearmRules = value;
  return campaignRulesOrUndefined(campaignRules);
}

export function withIgnoreAlignmentRestrictions(
  current: CharacterBuild["campaignRules"],
  value: boolean,
) {
  const campaignRules = { ...(current ?? {}) };
  if (value) campaignRules.ignoreAlignmentRestrictions = true;
  else delete campaignRules.ignoreAlignmentRestrictions;
  return campaignRulesOrUndefined(campaignRules);
}

export function withIgnoreEncumbrance(
  current: CharacterBuild["campaignRules"],
  value: boolean,
) {
  const campaignRules = { ...(current ?? {}) };
  if (value) campaignRules.ignoreEncumbrance = true;
  else delete campaignRules.ignoreEncumbrance;
  return campaignRulesOrUndefined(campaignRules);
}

export function useBuildBasicsEditor(
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
) {
  function updateBaseAbilityScore(ability: AbilityKey, value: number) {
    setBuild((previous) => ({
      ...previous,
      baseAbilityScores: {
        ...previous.baseAbilityScores,
        [ability]: Math.max(1, value),
      },
    }));
  }

  function updateRace(raceKey: string) {
    const nextRace = RUNTIME_RACES[raceKey];
    if (!nextRace) return;
    setBuild((previous) => ({
      ...previous,
      race: materializeRaceChoice(nextRace, previous, previous.race),
    }));
  }

  function updateRaceFlexibleAbility(value: AbilityKey) {
    setBuild((previous) => ({
      ...previous,
      race: {
        ...previous.race,
        choiceSelection: {
          ...(previous.race.choiceSelection ?? {}),
          flexibleAbility: value,
        },
      },
    }));
  }

  function updateRaceBonusFeat(value: string) {
    setBuild((previous) => ({
      ...previous,
      race: {
        ...previous.race,
        choiceSelection: {
          ...(previous.race.choiceSelection ?? {}),
          bonusFeat: value || undefined,
        },
      },
    }));
  }

  function toggleRaceAlternateTrait(traitId: string) {
    setBuild((previous) => {
      const current = new Set(
        (previous.race.choiceSelection?.alternateTraits ?? []).map((id) =>
          id.toLowerCase(),
        ),
      );
      const canonicalIds = new Map(
        (previous.race.alternateTraits ?? []).map((trait) => [
          trait.id.toLowerCase(),
          trait.id,
        ]),
      );
      const key = traitId.toLowerCase();
      if (current.has(key)) current.delete(key);
      else current.add(key);
      const nextAlternateTraits = [...current].map(
        (id) => canonicalIds.get(id) ?? id,
      );
      return {
        ...previous,
        race: materializeRaceChoice(previous.race, previous, {
          ...previous.race,
          choiceSelection: {
            ...(previous.race.choiceSelection ?? {}),
            alternateTraits: nextAlternateTraits,
          },
        }),
      };
    });
  }

  function updateAlignment(value: Alignment) {
    setBuild((previous) => ({ ...previous, alignment: value }));
  }

  function updateFavoredClassName(value: string) {
    setBuild((previous) => ({
      ...previous,
      favoredClassName: value || undefined,
    }));
  }

  function updateFirearmRulesMode(value: FirearmRulesMode) {
    setBuild((previous) =>
      syncTemplatedWeaponsToCampaignRules({
        ...previous,
        campaignRules: withFirearmRulesMode(previous.campaignRules, value),
      }),
    );
  }

  function updateIgnoreAlignmentRestrictions(value: boolean) {
    setBuild((previous) => ({
      ...previous,
      campaignRules: withIgnoreAlignmentRestrictions(
        previous.campaignRules,
        value,
      ),
    }));
  }

  function updateIgnoreEncumbrance(value: boolean) {
    setBuild((previous) => ({
      ...previous,
      campaignRules: withIgnoreEncumbrance(previous.campaignRules, value),
    }));
  }

  function updateInfantrymanGunTraining(weaponName: string) {
    setBuild((previous) => {
      const nextSelections = { ...(previous.gunTrainingSelections ?? {}) };
      if (weaponName.trim()) nextSelections.infantryman = [weaponName.trim()];
      else delete nextSelections.infantryman;
      return {
        ...previous,
        gunTrainingSelections:
          Object.keys(nextSelections).length > 0 ? nextSelections : undefined,
      };
    });
  }

  function updateClassArchetypes(className: string, archetypeIds: string[]) {
    setBuild((previous) => {
      const classKey = className.toLowerCase();
      const validIds = [
        ...new Set(
          archetypeIds
            .map((id) => id.trim().toLowerCase())
            .filter((id) => {
              const archetype = RUNTIME_ARCHETYPES[id];
              return (
                !!archetype &&
                archetype.baseClassName.toLowerCase() === classKey
              );
            }),
        ),
      ];
      const nextClassArchetypes = { ...(previous.classArchetypes ?? {}) };
      if (validIds.length > 0) nextClassArchetypes[classKey] = validIds;
      else delete nextClassArchetypes[classKey];
      return { ...previous, classArchetypes: nextClassArchetypes };
    });
  }

  return {
    toggleRaceAlternateTrait,
    updateAlignment,
    updateBaseAbilityScore,
    updateClassArchetypes,
    updateFavoredClassName,
    updateFirearmRulesMode,
    updateIgnoreAlignmentRestrictions,
    updateIgnoreEncumbrance,
    updateInfantrymanGunTraining,
    updateRace,
    updateRaceBonusFeat,
    updateRaceFlexibleAbility,
  };
}
