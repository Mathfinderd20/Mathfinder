import { useMemo, useState } from "react";
import {
  buildCharacter,
  computeSheet,
  applyLevelUp,
  type CharacterBuild,
  type CharacterCreationRules,
  type LevelUpSelection,
} from "@mathfinder/rules-engine";
import { CharacterCreationModal } from "./CharacterCreationModal";
import { LevelUpModal } from "./LevelUpModal";
import {
  applyGuidedLevelUp,
  withLevelUpCastingChoices,
  type LevelUpCastingChoices,
  type LevelUpSpellSeedPlan,
} from "../guidedLevelUp";
import { buildSuggestions } from "../buildSuggestions";
import { EMPTY_PLANNER_SUGGESTIONS } from "../app/useBuildAnalysis";
import {
  RUNTIME_CLASSES,
  RUNTIME_ARCHETYPES,
  RUNTIME_FEATS,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_SPELLS,
  RUNTIME_BUILD_GUIDES,
} from "../content";
import type { CharacterDetails } from "../features/characters/characterRepository";

/** Higher-level campaign starts use the same guide for each level; save once at the end. */
export function CharacterCreationFlow(props: {
  characterName: string;
  creationRules?: CharacterCreationRules;
  onConfirm: (build: CharacterBuild, details?: CharacterDetails) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CharacterBuild>();
  const [details, setDetails] = useState<CharacterDetails>();
  const target = Math.max(
    1,
    Math.min(20, props.creationRules?.startingLevel ?? 1),
  );
  const suggestions = useMemo(() => {
    if (!draft) return EMPTY_PLANNER_SUGGESTIONS;
    const sheet = computeSheet(
      buildCharacter(
        draft,
        RUNTIME_CLASSES,
        RUNTIME_FEATS,
        RUNTIME_CLASS_FEATURES,
        RUNTIME_ARCHETYPES,
      ),
      { spellRegistry: RUNTIME_SPELLS },
    );
    return (
      buildSuggestions({
        build: draft,
        currentLevel: draft.levels.length,
        sheetSpellcasting: sheet.spellcasting,
        classes: RUNTIME_CLASSES,
        feats: RUNTIME_FEATS,
        spells: RUNTIME_SPELLS,
        classFeatures: RUNTIME_CLASS_FEATURES,
        archetypes: RUNTIME_ARCHETYPES,
        buildGuides: RUNTIME_BUILD_GUIDES,
        plannerLevelIndexes: [draft.levels.length],
      }).planner[draft.levels.length] ?? EMPTY_PLANNER_SUGGESTIONS
    );
  }, [draft]);
  function advance(
    selection: LevelUpSelection,
    spells: LevelUpSpellSeedPlan[],
    languages?: CharacterBuild["languages"],
    castingChoices?: LevelUpCastingChoices,
  ) {
    if (!draft) return;
    const projected = withLevelUpCastingChoices(
      applyLevelUp(draft, selection),
      selection.className,
      castingChoices,
    );
    const casters = computeSheet(
      buildCharacter(
        projected,
        RUNTIME_CLASSES,
        RUNTIME_FEATS,
        RUNTIME_CLASS_FEATURES,
        RUNTIME_ARCHETYPES,
      ),
      { spellRegistry: RUNTIME_SPELLS },
    ).spellcasting;
    const next = applyGuidedLevelUp(
      draft,
      selection,
      spells,
      casters,
      languages,
      castingChoices,
    );
    if (next.levels.length >= target) props.onConfirm(next, details);
    else setDraft(next);
  }
  return draft ? (
    <LevelUpModal
      key={draft.levels.length}
      build={draft}
      plannerSuggestions={suggestions}
      onConfirm={advance}
      onClose={props.onClose}
    />
  ) : (
    <CharacterCreationModal
      {...props}
      confirmLabel={target > 1 ? "Continue to Level 2" : "Create Character"}
      onConfirm={(build, metadata) => {
        if (target === 1) props.onConfirm(build, metadata);
        else {
          setDetails(metadata);
          setDraft(build);
        }
      }}
    />
  );
}
