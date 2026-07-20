import {
  checkPrerequisites,
  featParameterOptions,
  featQualifiesForGrant,
  formatFeatSelection,
  listFeats,
  parseFeatSelection,
  type CharacterBuild,
  type FeatContext,
  type FeatGrantKind,
  type FeatRegistry,
  type WeaponDefinition,
} from "@mathfinder/rules-engine";
import type { CompendiumOption } from "./components/CompendiumPicker";
import { featTitle } from "./rulesText";

function featSelectionBaseName(selection: string): string {
  const trimmed = selection.trim();
  const match = /^(.*?)\s*\(.+\)\s*$/.exec(trimmed);
  return (match?.[1] ?? trimmed).trim().toLowerCase();
}

export function collectFeatWeaponNames(
  build: CharacterBuild,
  runtimeWeapons: WeaponDefinition[],
): string[] {
  return [
    ...new Set(
      [
        ...(build.race.grantedWeapons ?? []).map((weapon) => weapon.name),
        ...(build.weapons ?? []).map((weapon) => weapon.name),
        ...(build.equipment ?? [])
          .filter((item) => !!item.weapon)
          .map((item) => item.name),
        ...runtimeWeapons.map((weapon) => weapon.name),
      ]
        .map((name) => name?.trim() ?? "")
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

interface BuildFeatPickerOptionsArgs {
  featRegistry: FeatRegistry;
  featContext: FeatContext;
  grantKind: FeatGrantKind;
  takenSelections: string[];
  currentSelection?: string;
  availableWeaponNames?: string[];
  suggestedFeatNames?: Set<string>;
}

export function buildFeatPickerOptions({
  featRegistry,
  featContext,
  grantKind,
  takenSelections,
  currentSelection,
  availableWeaponNames,
  suggestedFeatNames,
}: BuildFeatPickerOptionsArgs): CompendiumOption[] {
  const normalizedCurrent = currentSelection?.trim().toLowerCase() ?? "";
  const taken = takenSelections.filter(
    (selection) => selection.trim().toLowerCase() !== normalizedCurrent,
  );

  return listFeats(featRegistry)
    .filter((feat) => featQualifiesForGrant(feat, grantKind))
    .flatMap((feat) => {
      const parameterChoices = feat.parameter
        ? featParameterOptions(feat, availableWeaponNames)
        : [undefined];
      return parameterChoices.map((parameterValue) => {
        const selectionName = formatFeatSelection(feat.name, parameterValue);
        return { feat, selectionName, parameterValue };
      });
    })
    .filter(({ feat, selectionName }) => {
      if (feat.repeatable) {
        return !taken.some(
          (selection) =>
            selection.toLowerCase() === selectionName.toLowerCase(),
        );
      }
      return !taken.some(
        (selection) =>
          featSelectionBaseName(selection) === feat.name.toLowerCase(),
      );
    })
    .map(({ feat, selectionName, parameterValue }) => ({
      feat,
      selectionName,
      parameterValue,
      prereq: checkPrerequisites(feat, { ...featContext, featNames: taken }),
    }))
    .filter(({ prereq }) => prereq.met)
    .sort((a, b) => {
      const aSuggested = suggestedFeatNames?.has(a.feat.name.toLowerCase())
        ? 1
        : 0;
      const bSuggested = suggestedFeatNames?.has(b.feat.name.toLowerCase())
        ? 1
        : 0;
      if (aSuggested !== bSuggested) return bSuggested - aSuggested;
      return a.selectionName.localeCompare(b.selectionName);
    })
    .map(({ feat, selectionName, parameterValue }) => ({
      id: `${feat.id}:${parameterValue?.toLowerCase() ?? "base"}`,
      name: selectionName,
      searchText: [
        feat.description,
        ...feat.prerequisites.map((prereq) => prereq.description),
        ...(feat.tags ?? []),
        parameterValue,
      ].filter((value): value is string => Boolean(value)),
      tooltip: featTitle(selectionName),
      tags: [
        grantKind,
        ...(feat.tags ?? []),
        ...(parameterValue ? [parameterValue] : []),
      ],
    })) satisfies CompendiumOption[];
}

export function normalizeSelectedFeatSelection(
  featRegistry: FeatRegistry,
  value: string,
): string {
  return parseFeatSelection(featRegistry, value)?.selectionName ?? value;
}
