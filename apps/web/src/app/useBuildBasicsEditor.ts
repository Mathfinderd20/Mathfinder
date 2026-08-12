import type { Dispatch, SetStateAction } from "react";
import type {
  AbilityKey,
  CharacterBuild,
  FirearmRulesMode,
} from "@mathfinder/rules-engine";
import { RUNTIME_ARCHETYPES, RUNTIME_RACES } from "../content";
import {
  materializeRaceChoice,
  syncTemplatedWeaponsToCampaignRules,
} from "./buildNormalization";

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
        campaignRules:
          value === "standard"
            ? undefined
            : { ...(previous.campaignRules ?? {}), firearmRules: value },
      }),
    );
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
    updateBaseAbilityScore,
    updateClassArchetypes,
    updateFavoredClassName,
    updateFirearmRulesMode,
    updateRace,
    updateRaceBonusFeat,
    updateRaceFlexibleAbility,
  };
}
