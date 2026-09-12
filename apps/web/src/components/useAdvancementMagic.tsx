import { useMemo, useState } from "react";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
  type LevelUpSelection,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_ARCHETYPES,
  RUNTIME_SPELLS,
} from "../content";
import type { SpellSuggestionChoice } from "../buildSuggestions";
import {
  applyGuidedLevelUp,
  type LevelUpSpellSeedPlan,
} from "../guidedLevelUp";
import {
  buildStartingSpellPlans,
  buildSpellSeedGroups,
  buildSpellSeedPlans,
  buildSpellbookGrantGroups,
  buildSpellbookGrantPlans,
  spellSeedSelectionsAreComplete,
  type SpellSeedSelections,
} from "../spellSeedPlans";
import {
  CreationMagicChoices,
  creationMagicErrors,
  type CreationMagicState,
} from "./CreationMagicChoices";
import {
  PreparedSpellChoices,
  type PreparationChoices,
} from "./PreparedSpellChoices";
import { SpellSeedPicker } from "./SpellSeedPicker";
import { SpellbookFreeSpellPicker } from "./SpellbookFreeSpellPicker";

export function useAdvancementMagic(
  build: CharacterBuild,
  preview: CharacterBuild,
  selection: LevelUpSelection,
  suggestions: Record<string, Partial<Record<number, SpellSuggestionChoice[]>>>,
) {
  const [initial, setInitial] = useState<CreationMagicState>({});
  const [known, setKnown] = useState<SpellSeedSelections>({});
  const [book, setBook] = useState<SpellSeedSelections>({});
  const [prepared, setPrepared] = useState<PreparationChoices>({});
  const classKey = selection.className.toLowerCase();
  const firstLevel = !build.levels.some(
    (level) => level.className.toLowerCase() === classKey,
  );
  const magicBuild = useMemo(
    () => ({
      ...preview,
      spellLibrary: { ...preview.spellLibrary, ...initial.spellLibrary },
      spellSelections: {
        ...preview.spellSelections,
        ...initial.spellSelections,
      },
      spellDomains: { ...preview.spellDomains, ...initial.spellDomains },
      spellSpecializations: {
        ...preview.spellSpecializations,
        ...initial.spellSpecializations,
      },
      spellBloodlines: {
        ...preview.spellBloodlines,
        ...initial.spellBloodlines,
      },
    }),
    [preview, initial],
  );
  const casters = useMemo(
    () =>
      computeSheet(
        buildCharacter(
          magicBuild,
          RUNTIME_CLASSES,
          RUNTIME_FEATS,
          RUNTIME_CLASS_FEATURES,
          RUNTIME_ARCHETYPES,
        ),
        { spellRegistry: RUNTIME_SPELLS },
      ).spellcasting,
    [magicBuild],
  );
  const caster = casters.find(
    (entry) => entry.className.toLowerCase() === classKey,
  );
  const knownGroups =
    !firstLevel && caster ? buildSpellSeedGroups([caster], suggestions) : [];
  const bookGroups =
    !firstLevel && caster
      ? buildSpellbookGrantGroups(caster, suggestions[classKey] ?? {})
      : [];
  const grantsBook = !firstLevel && caster?.spellAccess === "spellbook";
  const plans: LevelUpSpellSeedPlan[] = [];
  const errors: string[] = [];
  if (firstLevel && caster) {
    errors.push(...creationMagicErrors(magicBuild, [caster]));
    plans.push(...buildStartingSpellPlans(initial, [caster]));
  } else {
    plans.push(
      ...buildSpellSeedPlans(knownGroups, known),
      ...buildSpellbookGrantPlans(bookGroups, book),
    );
    if (!spellSeedSelectionsAreComplete(knownGroups, known))
      errors.push("Choose every newly available known spell.");
    for (const [level, spells] of Object.entries(prepared))
      if (spells?.length)
        plans.push({
          classKey,
          level: Number(level),
          mode: "prepared",
          spells,
        });
  }
  let proposedBuild = preview;
  try {
    proposedBuild = applyGuidedLevelUp(
      build,
      selection,
      plans,
      casters,
      undefined,
      initial,
    );
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Review the spell choices.",
    );
  }
  // The preparation picker can offer book spells acquired in this same draft.
  const preparationCaster = caster
    ? {
        ...caster,
        selectionDiagnostics: Object.fromEntries(
          Object.entries(caster.selectionDiagnostics).map(
            ([level, diagnostic]) => [
              level,
              diagnostic
                ? {
                    ...diagnostic,
                    librarySpellNames: [
                      ...diagnostic.librarySpellNames,
                      ...plans
                        .filter(
                          (plan) =>
                            plan.mode === "library" &&
                            plan.level === Number(level),
                        )
                        .flatMap((plan) => plan.spells),
                    ],
                  }
                : diagnostic,
            ],
          ),
        ),
      }
    : undefined;
  const choices =
    firstLevel && caster ? (
      <CreationMagicChoices
        build={magicBuild}
        value={initial}
        onChange={setInitial}
        classKey={classKey}
      />
    ) : (
      <>
        {grantsBook && (
          <SpellbookFreeSpellPicker
            groups={bookGroups}
            selections={book}
            onChange={setBook}
          />
        )}
        {!!knownGroups.length && (
          <SpellSeedPicker
            groups={knownGroups}
            selections={known}
            onChange={setKnown}
            required
          />
        )}
        {preparationCaster && (
          <PreparedSpellChoices
            caster={preparationCaster}
            value={prepared}
            onChange={setPrepared}
            additions
          />
        )}
        {caster?.spellAccess === "full-list" && (
          <p className="guide-policy">
            Newly unlocked class spells are included in your library
            automatically.
          </p>
        )}
      </>
    );
  return {
    plans,
    errors,
    choices,
    casters,
    proposedBuild,
    castingChoices: initial,
    reset: () => {
      setInitial({});
      setKnown({});
      setBook({});
      setPrepared({});
    },
  };
}
