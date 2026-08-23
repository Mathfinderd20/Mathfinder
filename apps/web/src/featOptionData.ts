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
  const normalizeNames = (names: Array<string | undefined>) =>
    names.map((name) => name?.trim() ?? "").filter(Boolean);
  const ownedNames = [
    ...new Set(
      normalizeNames([
        ...(build.race.grantedWeapons ?? []).map((weapon) => weapon.name),
        ...(build.weapons ?? []).map((weapon) => weapon.name),
        ...(build.equipment ?? [])
          .filter((item) => !!item.weapon)
          .map((item) => item.name),
      ]),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const ownedKeys = new Set(ownedNames.map((name) => name.toLowerCase()));
  const catalogNames = [
    ...new Set(normalizeNames(runtimeWeapons.map((weapon) => weapon.name))),
  ]
    .filter((name) => !ownedKeys.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return [...ownedNames, ...catalogNames];
}

interface BuildFeatPickerOptionsArgs {
  featRegistry: FeatRegistry;
  featContext: FeatContext;
  grantKind: FeatGrantKind;
  takenSelections: string[];
  currentSelection?: string;
  availableWeaponNames?: string[];
  suggestedFeatNames?: Set<string>;
  query?: string;
  maxOptions?: number;
}

interface LooseFeatSearchOptionsArgs {
  featRegistry: FeatRegistry;
  grantKind: FeatGrantKind;
  availableWeaponNames?: string[];
  query?: string;
}

export function buildFeatPickerOptions({
  featRegistry,
  featContext,
  grantKind,
  takenSelections,
  currentSelection,
  availableWeaponNames,
  suggestedFeatNames,
  query,
  maxOptions,
}: BuildFeatPickerOptionsArgs): CompendiumOption[] {
  const normalizedCurrent = currentSelection?.trim().toLowerCase() ?? "";
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const taken = takenSelections.filter(
    (selection) => selection.trim().toLowerCase() !== normalizedCurrent,
  );

  return listFeats(featRegistry)
    .filter((feat) => featQualifiesForGrant(feat, grantKind))
    .filter((feat) => {
      if (!normalizedQuery) return true;
      const baseParts = [
        feat.name,
        feat.id,
        feat.description,
        ...feat.prerequisites.map((prereq) => prereq.description),
        ...(feat.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return (
        baseParts.includes(normalizedQuery) ||
        (!!feat.parameter && normalizedQuery.includes(feat.name.toLowerCase()))
      );
    })
    .flatMap((feat) => {
      const parameterChoices = feat.parameter
        ? featParameterOptions(feat, availableWeaponNames).filter(
            (choice) =>
              !normalizedQuery ||
              formatFeatSelection(feat.name, choice)
                .toLowerCase()
                .includes(normalizedQuery),
          )
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
      prereq: checkPrerequisites(
        feat,
        { ...featContext, featNames: taken },
        parameterValue,
      ),
    }))
    .sort((a, b) => {
      const aMet = a.prereq.met ? 1 : 0;
      const bMet = b.prereq.met ? 1 : 0;
      if (aMet !== bMet) return bMet - aMet;
      const aSuggested = suggestedFeatNames?.has(a.feat.name.toLowerCase())
        ? 1
        : 0;
      const bSuggested = suggestedFeatNames?.has(b.feat.name.toLowerCase())
        ? 1
        : 0;
      if (aSuggested !== bSuggested) return bSuggested - aSuggested;
      return a.selectionName.localeCompare(b.selectionName);
    })
    .slice(0, maxOptions ?? Number.POSITIVE_INFINITY)
    .map(({ feat, selectionName, parameterValue, prereq }) => ({
      id: `${feat.id}:${parameterValue?.toLowerCase() ?? "base"}`,
      name: selectionName,
      searchText: [
        feat.description,
        ...feat.prerequisites.map((prereq) => prereq.description),
        ...(feat.tags ?? []),
        parameterValue,
      ].filter((value): value is string => Boolean(value)),
      tooltip: [
        featTitle(selectionName),
        !prereq.met && prereq.unmet.length > 0
          ? `Unmet: ${prereq.unmet.map((entry) => entry.description).join(", ")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n\n"),
      tags: [
        grantKind,
        ...(feat.tags ?? []),
        ...(parameterValue ? [parameterValue] : []),
        prereq.met ? "ready" : "unmet",
      ],
    })) satisfies CompendiumOption[];
}

export function buildLooseFeatSearchOptions({
  featRegistry,
  grantKind,
  availableWeaponNames,
  query,
}: LooseFeatSearchOptionsArgs): CompendiumOption[] {
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  return listFeats(featRegistry)
    .filter((feat) => featQualifiesForGrant(feat, grantKind))
    .flatMap((feat) => {
      const parameterChoices = feat.parameter
        ? featParameterOptions(feat, availableWeaponNames).filter(
            (choice) =>
              !normalizedQuery ||
              formatFeatSelection(feat.name, choice)
                .toLowerCase()
                .includes(normalizedQuery),
          )
        : [undefined];
      return parameterChoices.map((parameterValue) => {
        const selectionName = formatFeatSelection(feat.name, parameterValue);
        return { feat, selectionName, parameterValue };
      });
    })
    .filter(({ feat, selectionName, parameterValue }) => {
      if (!normalizedQuery) return true;
      return [
        feat.name,
        feat.id,
        feat.description,
        ...feat.prerequisites.map((prereq) => prereq.description),
        ...(feat.tags ?? []),
        parameterValue,
        selectionName,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => a.selectionName.localeCompare(b.selectionName))
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
