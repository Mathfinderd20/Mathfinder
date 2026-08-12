import { useEffect, useMemo, useState } from "react";
import {
  listFeats,
  validateBuild,
  type CharacterBuild,
  type DerivedSheet,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_BUILD_GUIDES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_SPELLS,
} from "../content";
import {
  buildSuggestions,
  type BuildSuggestionBundle,
  type LevelPlannerSuggestions,
} from "../buildSuggestions";
import type { RuntimeProfile } from "../runtimeInsights";
import { summarizeWealth } from "../wealth";

const VALIDATION_DEBOUNCE_MS = 200;
export const EMPTY_PLANNER_SUGGESTIONS: LevelPlannerSuggestions = {
  guideChoices: [],
  classChoices: [],
  featChoices: [],
  featChoicesBySlot: [],
  favoredClassChoices: [],
  abilityChoices: [],
  notes: [],
};
const EMPTY_SUGGESTION_BUNDLE: BuildSuggestionBundle = {
  planner: Array.from({ length: 20 }, () => EMPTY_PLANNER_SUGGESTIONS),
  currentLevelSkills: [],
  currentLevelSkillNotes: [],
  spellChoices: {},
};

export function useBuildAnalysis(args: {
  deferredBuild: CharacterBuild;
  effectiveBuild: CharacterBuild;
  currentLevel: number;
  sheet: DerivedSheet;
  shouldComputeSuggestions: boolean;
}) {
  const {
    deferredBuild,
    effectiveBuild,
    currentLevel,
    sheet,
    shouldComputeSuggestions,
  } = args;
  const [issues, setIssues] = useState<ReturnType<typeof validateBuild>>(() =>
    validateBuild(
      effectiveBuild,
      RUNTIME_CLASSES,
      RUNTIME_SPELLS,
      RUNTIME_ARCHETYPES,
      RUNTIME_FEATS,
    ),
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIssues(
        validateBuild(
          effectiveBuild,
          RUNTIME_CLASSES,
          RUNTIME_SPELLS,
          RUNTIME_ARCHETYPES,
          RUNTIME_FEATS,
        ),
      );
    }, VALIDATION_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [effectiveBuild]);

  const errors = issues.filter((issue) => issue.severity === "error");
  const featOptions = useMemo(
    () =>
      listFeats(RUNTIME_FEATS)
        .filter(
          (feat) =>
            !!feat &&
            typeof feat.name === "string" &&
            feat.name.trim().length > 0,
        )
        .map((feat) => ({
          id: feat.id,
          name: feat.name,
          tooltip: [
            feat.name,
            feat.description,
            feat.prerequisites.length
              ? `Prerequisites: ${feat.prerequisites.map((prerequisite) => prerequisite.description).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          searchText: [
            feat.description,
            feat.prerequisites
              .map((prerequisite) => prerequisite.description)
              .join(" "),
            feat.pack,
          ],
          tags: (feat.tags ?? []).map((tag) => tag.toLowerCase()),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const suggestionBundle = useMemo(
    () =>
      shouldComputeSuggestions
        ? buildSuggestions({
            build: deferredBuild,
            currentLevel,
            sheetSpellcasting: sheet.spellcasting,
            classes: RUNTIME_CLASSES,
            feats: RUNTIME_FEATS,
            spells: RUNTIME_SPELLS,
            classFeatures: RUNTIME_CLASS_FEATURES,
            archetypes: RUNTIME_ARCHETYPES,
            buildGuides: RUNTIME_BUILD_GUIDES,
            includeGuides: false,
          })
        : EMPTY_SUGGESTION_BUNDLE,
    [currentLevel, deferredBuild, shouldComputeSuggestions, sheet.spellcasting],
  );
  const [guidedPlannerSuggestions, setGuidedPlannerSuggestions] = useState<
    Partial<Record<number, LevelPlannerSuggestions>>
  >({});
  const plannerSuggestions = useMemo(
    () =>
      suggestionBundle.planner.map(
        (suggestions, index) => guidedPlannerSuggestions[index] ?? suggestions,
      ),
    [guidedPlannerSuggestions, suggestionBundle.planner],
  );

  function computeGuidedSuggestionBundle(targetBuild: CharacterBuild) {
    return buildSuggestions({
      build: targetBuild,
      currentLevel,
      sheetSpellcasting: sheet.spellcasting,
      classes: RUNTIME_CLASSES,
      feats: RUNTIME_FEATS,
      spells: RUNTIME_SPELLS,
      classFeatures: RUNTIME_CLASS_FEATURES,
      archetypes: RUNTIME_ARCHETYPES,
      buildGuides: RUNTIME_BUILD_GUIDES,
      includeGuides: true,
    });
  }

  const wealthSummary = useMemo(
    () => summarizeWealth(deferredBuild),
    [deferredBuild],
  );
  const runtimeProfile = useMemo<RuntimeProfile>(
    () => ({
      classNames: [
        ...new Set(
          effectiveBuild.levels.map((level) => level.className.toLowerCase()),
        ),
      ],
      meleeFocus:
        sheet.attack.melee.total >= sheet.attack.ranged.total ||
        sheet.abilities.str.score > sheet.abilities.dex.score,
      rangedFocus:
        sheet.attack.ranged.total > sheet.attack.melee.total ||
        !!effectiveBuild.weapons?.some(
          (weapon) => weapon.category === "ranged",
        ) ||
        !!effectiveBuild.equipment?.some(
          (item) => item.weapon?.category === "ranged",
        ),
      casterFocus: sheet.spellcasting.length > 0,
      strengthScore: sheet.abilities.str.score,
      dexScore: sheet.abilities.dex.score,
      conScore: sheet.abilities.con.score,
    }),
    [effectiveBuild, sheet],
  );

  return {
    computeGuidedSuggestionBundle,
    errors,
    featOptions,
    plannerSuggestions,
    setGuidedPlannerSuggestions,
    suggestionBundle,
    wealthSummary,
    runtimeProfile,
  };
}
