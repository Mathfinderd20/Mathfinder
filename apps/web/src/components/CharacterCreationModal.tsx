import { CharacterGuide, type GuideStep } from "./CharacterGuide";
import {
  applySpellSeedPlans,
  buildStartingSpellPlans,
} from "../spellSeedPlans";
import {
  CreationMagicChoices,
  creationMagicErrors,
  type CreationMagicState,
} from "./CreationMagicChoices";
import { LanguageFields } from "./CharacterLanguages";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCharacter,
  deriveLanguages,
  classAllowsAlignment,
  computeSheet,
  resolveRaceChoice,
  planLevelUp,
  validateBuild,
  validateCampaignTraits,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type Alignment,
  type CharacterBuild,
  type SkillKey,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_CLASSES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_CLASS_OPTIONS,
  RUNTIME_FEATS,
  RUNTIME_RACE_OPTIONS,
  RUNTIME_SPELLS,
  RUNTIME_WEAPONS,
} from "../content";
import {
  buildFeatBaseEligibilityOptions,
  collectFeatWeaponNames,
} from "../featOptionData";
import { plannedFeatSlotsForLevel } from "../featSlots";
import {
  buildFavoredClassBonusOptions,
  favoredClassBonusDetailIsComplete,
} from "../favoredClassBonusData";
import { FavoredClassBonusPicker } from "./FavoredClassBonusPicker";
import { createFreshCharacterBuild } from "../features/characters/newCharacterBuild";
import { AlignmentPicker } from "./AlignmentPicker";
import {
  creationWarnings,
  pointBuyTotal,
  type CharacterCreationRules,
} from "@mathfinder/rules-engine";
import { FeatSelectionPicker } from "./FeatSelectionPicker";
import {
  MAX_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  parseAbilityScoreInput,
} from "../abilityScoreInput";
import type { CharacterDetails } from "../features/characters/characterRepository";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const DEFAULT_SCORE_INPUTS: Record<AbilityKey, string> = {
  str: "10",
  dex: "10",
  con: "10",
  int: "10",
  wis: "10",
  cha: "10",
};

interface Props {
  creationRules?: CharacterCreationRules;
  characterName: string;
  onConfirm: (build: CharacterBuild, details?: CharacterDetails) => void;
  onClose: () => void;
  confirmLabel?: string;
}

function uniqueRaceOptions() {
  const seen = new Set<string>();
  return RUNTIME_RACE_OPTIONS.filter(([, race]) => {
    const key = race.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classKeyForName(name: string) {
  return (
    Object.keys(RUNTIME_CLASSES).find(
      (key) => RUNTIME_CLASSES[key]?.name.toLowerCase() === name.toLowerCase(),
    ) ?? name.toLowerCase()
  );
}

export function CharacterCreationModal({
  creationRules,
  characterName,
  onConfirm,
  onClose,
  confirmLabel = "Create Character",
}: Props) {
  const raceOptions = useMemo(uniqueRaceOptions, []);
  const defaultRaceKey =
    raceOptions.find(([, race]) => race.name.toLowerCase() === "human")?.[0] ??
    raceOptions[0]?.[0] ??
    "human";
  const defaultClassName =
    RUNTIME_CLASS_OPTIONS.find((entry) => entry.name === "Fighter")?.name ??
    RUNTIME_CLASS_OPTIONS[0]?.name ??
    "Fighter";
  const [step, setStep] = useState(0);
  const [alternateTraits, setAlternateTraits] = useState<string[]>([]);
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [archetypeSearch, setArchetypeSearch] = useState("");
  const [magicChoices, setMagicChoices] = useState<CreationMagicState>({});
  const [raceKey, setRaceKey] = useState(defaultRaceKey);
  const [languages, setLanguages] = useState<
    NonNullable<CharacterBuild["languages"]>
  >({});
  const [alignment, setAlignment] = useState<Alignment>("true-neutral");
  const [ignoreAlignmentRestrictions, setIgnoreAlignmentRestrictions] =
    useState(false);
  const [ignoreEncumbrance, setIgnoreEncumbrance] = useState(false);
  const [className, setClassName] = useState(defaultClassName);
  const [abilityScoreInputs, setAbilityScoreInputs] =
    useState(DEFAULT_SCORE_INPUTS);
  const abilityScores = useMemo(() => {
    const entries = ABILITIES.map(
      (ability) =>
        [ability, parseAbilityScoreInput(abilityScoreInputs[ability])] as const,
    );
    if (entries.some(([, score]) => score === undefined)) return undefined;
    return Object.fromEntries(entries) as Record<AbilityKey, number>;
  }, [abilityScoreInputs]);
  const warnings =
    creationRules && abilityScores
      ? creationWarnings(
          ABILITIES.map((ability) => abilityScores[ability]),
          creationRules.startingLevel,
          creationRules,
        )
      : [];
  let pointBuy: number | undefined;
  try {
    if (abilityScores)
      pointBuy = pointBuyTotal(
        ABILITIES.map((ability) => abilityScores[ability]),
      );
  } catch {
    /* Manual scores may exceed point-buy bounds. */
  }
  const [flexibleAbility, setFlexibleAbility] = useState<AbilityKey>("str");
  const [selectedSkills, setSelectedSkills] = useState<Set<SkillKey>>(
    new Set(),
  );
  const [selectedFeats, setSelectedFeats] = useState<string[]>([]);
  const [raceBonusFeat, setRaceBonusFeat] = useState("");
  const [favoredClass, setFavoredClass] = useState<string | undefined>("hp");
  const [favoredClassSelection, setFavoredClassSelection] = useState<string>();
  const [campaignTraits, setCampaignTraits] = useState<string[]>([]);
  const traitLimit = creationRules?.campaignTraitLimit ?? 3;

  const race =
    RUNTIME_RACE_OPTIONS.find(([key]) => key === raceKey)?.[1] ??
    raceOptions[0]?.[1];
  const classKey = classKeyForName(className);
  const classDefinition = RUNTIME_CLASSES[classKey];
  const resolvedRace = race ?? RUNTIME_RACE_OPTIONS[0]![1];
  const activeRace = resolveRaceChoice({
    ...resolvedRace,
    choiceSelection: { alternateTraits },
  });
  const classArchetypeOptions = Object.values(RUNTIME_ARCHETYPES).filter(
    (entry) => entry.baseClassName.toLowerCase() === className.toLowerCase(),
  );
  const creationFavoredClassBonusOptions = buildFavoredClassBonusOptions(
    resolvedRace,
    className,
  );
  const hasFlexibleAbility = !!activeRace.choiceOptions?.flexibleAbilityBonus;
  const hasRaceBonusFeat = !!activeRace.choiceOptions?.bonusFeat;

  const createBuild = useCallback(
    (scores: Record<AbilityKey, number>) => {
      if (!race || !classDefinition) return undefined;
      return createFreshCharacterBuild(characterName, race, {
        className: classDefinition.name,
        alignment,
        hitPointRoll: classDefinition.hitDie,
        baseAbilityScores: scores,
        flexibleAbility: hasFlexibleAbility ? flexibleAbility : undefined,
        raceBonusFeat: hasRaceBonusFeat ? raceBonusFeat : undefined,
        skillRanks: Object.fromEntries(
          [...selectedSkills].map((skill) => [skill, 1]),
        ),
        feats: selectedFeats,
        favoredClass,
        favoredClassSelection,
        ignoreAlignmentRestrictions,
        ignoreEncumbrance,
        alternateTraits,
        archetypes,
        ...magicChoices,
      });
    },
    [
      alignment,
      alternateTraits,
      archetypes,
      magicChoices,
      characterName,
      classDefinition,
      favoredClass,
      favoredClassSelection,
      flexibleAbility,
      hasFlexibleAbility,
      hasRaceBonusFeat,
      ignoreAlignmentRestrictions,
      ignoreEncumbrance,
      race,
      raceBonusFeat,
      selectedFeats,
      selectedSkills,
    ],
  );
  const draftBuild = useMemo(
    () => (abilityScores ? createBuild(abilityScores) : undefined),
    [createBuild, abilityScores],
  );

  const previewSheet = useMemo(
    () =>
      draftBuild
        ? computeSheet(
            buildCharacter(
              draftBuild,
              RUNTIME_CLASSES,
              RUNTIME_FEATS,
              RUNTIME_CLASS_FEATURES,
              RUNTIME_ARCHETYPES,
            ),
            { spellRegistry: RUNTIME_SPELLS },
          )
        : undefined,
    [draftBuild],
  );
  const featSlots = useMemo(
    () => (draftBuild ? plannedFeatSlotsForLevel(draftBuild, 0) : []),
    [draftBuild],
  );
  const skillPlan = draftBuild
    ? planLevelUp(
        { ...draftBuild, levels: [] },
        className,
        RUNTIME_CLASSES,
        RUNTIME_ARCHETYPES,
      )
    : undefined;
  const skillPoints =
    (skillPlan?.skillPoints ?? 1) + (favoredClass === "skill" ? 1 : 0);
  const remainingSkills = skillPoints - selectedSkills.size;
  const classSkills = new Set(skillPlan?.classSkills ?? []);

  useEffect(() => {
    setSelectedFeats((previous) => previous.slice(0, featSlots.length));
  }, [featSlots.length]);

  useEffect(() => {
    if (!hasRaceBonusFeat) setRaceBonusFeat("");
  }, [hasRaceBonusFeat]);

  useEffect(() => {
    if (
      !creationFavoredClassBonusOptions.some(
        (option) => option.value === (favoredClass ?? ""),
      )
    ) {
      setFavoredClass("hp");
      setFavoredClassSelection(undefined);
    }
  }, [creationFavoredClassBonusOptions, favoredClass]);

  const availableWeaponNames = useMemo(
    () =>
      draftBuild ? collectFeatWeaponNames(draftBuild, RUNTIME_WEAPONS) : [],
    [draftBuild],
  );
  const featOptionCache = useMemo(
    () => new Map<string, ReturnType<typeof buildFeatBaseEligibilityOptions>>(),
    [],
  );
  const resolveFeatOptions = useCallback(
    (
      grantKind: "general" | "fighter-bonus",
      currentSelection: string | undefined,
    ) => {
      const cacheKey = [
        grantKind,
        currentSelection?.trim().toLowerCase() ?? "",
        raceBonusFeat,
        ...selectedFeats,
      ].join("\u0000");
      const cached = featOptionCache.get(cacheKey);
      if (cached) return cached;
      const options = buildFeatBaseEligibilityOptions({
        featRegistry: RUNTIME_FEATS,
        grantKind,
        takenSelections: [raceBonusFeat, ...selectedFeats].filter(Boolean),
        currentSelection,
      });
      featOptionCache.set(cacheKey, options);
      return options;
    },
    [featOptionCache, raceBonusFeat, selectedFeats],
  );

  const classAlignmentAllowed =
    !!classDefinition &&
    classAllowsAlignment(classDefinition, alignment, {
      ignoreAlignmentRestrictions,
    });
  const missingRequiredFeat =
    selectedFeats.filter(Boolean).length < featSlots.length ||
    (hasRaceBonusFeat && !raceBonusFeat);
  const languageRules = draftBuild ? deriveLanguages(draftBuild) : undefined;
  const buildIssues = draftBuild
    ? validateBuild(
        { ...draftBuild, languages },
        RUNTIME_CLASSES,
        RUNTIME_SPELLS,
        RUNTIME_ARCHETYPES,
        RUNTIME_FEATS,
      ).filter((issue) => issue.severity === "error")
    : [];
  const featErrors = buildIssues.filter(
    (issue) =>
      issue.code.includes("feat") && !issue.code.includes("race-alternate"),
  );
  const raceErrors = buildIssues.filter(
    (issue) =>
      issue.code.includes("race-alternate") || issue.code.includes("flexible"),
  );
  const otherErrors = buildIssues.filter(
    (issue) => !featErrors.includes(issue) && !raceErrors.includes(issue),
  );
  const startingPlans = buildStartingSpellPlans(
    magicChoices,
    previewSheet?.spellcasting ?? [],
  );
  let reviewedBuild = draftBuild;
  const spellPlanErrors: string[] = [];
  if (draftBuild) {
    try {
      reviewedBuild = applySpellSeedPlans(
        { ...draftBuild, spellLibrary: {}, spellSelections: {} },
        startingPlans,
        previewSheet?.spellcasting ?? [],
      );
    } catch (error) {
      spellPlanErrors.push(
        error instanceof Error ? error.message : "Review your starting magic.",
      );
    }
  }
  const steps: GuideStep[] = [
    {
      id: "foundation",
      label: "Foundation",
      title: "Start with your character’s foundation",
      description:
        "Set your alignment and the campaign rules that shape the build.",
    },
    {
      id: "race",
      label: "Race",
      title: "Choose Race & Racial Traits",
      description:
        "Standard traits apply automatically. Review flexible choices and alternate traits before continuing.",
      errors: raceErrors.map((issue) => issue.message),
    },
    {
      id: "abilities",
      label: "Abilities",
      title: "Assign your ability scores",
      description:
        "Enter base scores before racial bonuses. Your preview includes the adjustments.",
      errors: !abilityScores
        ? ["Enter a valid whole number for every ability score."]
        : warnings.filter((warning) => !warning.startsWith("Campaign starts")),
    },
    {
      id: "class",
      label: "Class",
      title: "Choose your first class",
      description:
        "Your class establishes hit points, skills, feats, and spellcasting.",
      errors: [
        ...(!classAlignmentAllowed
          ? [
              classDefinition?.alignmentRestriction?.description ??
                "Choose an available class.",
            ]
          : []),
        ...(!favoredClassBonusDetailIsComplete(
          creationFavoredClassBonusOptions,
          favoredClass,
          favoredClassSelection,
        )
          ? ["Complete the favored-class bonus detail."]
          : []),
      ],
    },
    {
      id: "skills",
      label: "Skills",
      title: "Train skills & choose languages",
      description:
        "Spend your skill ranks, then choose any languages your race and training allow.",
      errors: [
        ...(remainingSkills !== 0
          ? [
              `Assign all ${skillPoints} skill ranks (${remainingSkills} remaining).`,
            ]
          : []),
        ...((languages.starting?.length ?? 0) >
          (languageRules?.startingCapacity ?? 0) ||
        (languages.learned?.length ?? 0) > (languageRules?.learnedCapacity ?? 0)
          ? ["Language choices exceed the available allowance."]
          : []),
      ],
    },
    {
      id: "feats",
      label: "Feats",
      title: "Choose feats & starting magic",
      description:
        "Make the choices granted by your race and class. Your spell library follows your class’s acquisition rules.",
      errors: [
        ...(missingRequiredFeat ? ["Choose every granted feat."] : []),
        ...featErrors.map((issue) => issue.message),
        ...creationMagicErrors(draftBuild, previewSheet?.spellcasting ?? []),
        ...spellPlanErrors,
      ],
    },
    {
      id: "traits",
      label: "Campaign Traits",
      title: "Choose Campaign Traits",
      description:
        "Optional story traits are saved with your character’s campaign details.",
      optional: true,
      errors: validateCampaignTraits(campaignTraits, creationRules),
    },
    {
      id: "review",
      label: "Review",
      title: "Review your character",
      description:
        "Check the completed build. Nothing is saved until you create the character.",
      errors: otherErrors.map((issue) => issue.message),
    },
  ];
  function confirmCreation() {
    if (steps.some((entry) => entry.errors?.length) || !abilityScores) return;
    const finalBuild = reviewedBuild;
    if (finalBuild)
      onConfirm(
        { ...finalBuild, languages },
        {
          campaignTraits: campaignTraits
            .map((trait) => trait.trim())
            .filter(Boolean),
        },
      );
  }

  function updateAbility(ability: AbilityKey, rawValue: string) {
    setAbilityScoreInputs((previous) => ({
      ...previous,
      [ability]: rawValue,
    }));
  }

  function toggleSkill(skill: SkillKey) {
    setSelectedSkills((previous) => {
      const next = new Set(previous);
      if (next.has(skill)) next.delete(skill);
      else if (next.size < skillPoints) next.add(skill);
      return next;
    });
  }

  return (
    <CharacterGuide
      kind="creation"
      title="Creation Guide"
      subtitle={`Build ${characterName.trim() || "Unnamed Hero"} · Level 1`}
      steps={steps}
      step={step}
      onStep={setStep}
      onClose={onClose}
      onConfirm={confirmCreation}
      confirmLabel={confirmLabel}
      summary={
        <>
          <strong>
            {race?.name} · {classDefinition?.name} 1
          </strong>
          <span>
            {selectedSkills.size}/{skillPoints} skill ranks
          </span>
          <span>
            {[raceBonusFeat, ...selectedFeats].filter(Boolean).length}/
            {featSlots.length + (hasRaceBonusFeat ? 1 : 0)} feats
          </span>
        </>
      }
    >
      {step === 0 && (
        <>
          <div className="guide-policy">
            <strong>{characterName}</strong> starts at level 1. Choose your
            identity and campaign rules, then build each part of the character.
            {(creationRules?.startingLevel ?? 1) > 1 && (
              <p>
                Next, the advancement guide will take you through each level up
                to level {creationRules!.startingLevel}. Your character is saved
                after the final level.
              </p>
            )}
          </div>
          {creationRules?.buildGuide && (
            <p className="guide-policy">{creationRules.buildGuide}</p>
          )}
          <div className="field compact alignment-field">
            <span>Alignment</span>
            <AlignmentPicker value={alignment} onChange={setAlignment} />
          </div>

          <label className="pick campaign-rule-pick">
            <input
              type="checkbox"
              checked={ignoreAlignmentRestrictions}
              onChange={(event) =>
                setIgnoreAlignmentRestrictions(event.target.checked)
              }
            />
            <span>
              <strong>Ignore alignment restrictions</strong>
              <span className="buff-desc">
                House rule: all class alignment requirements are disabled.
              </span>
            </span>
          </label>

          <label className="pick campaign-rule-pick">
            <input
              type="checkbox"
              checked={ignoreEncumbrance}
              onChange={(event) => setIgnoreEncumbrance(event.target.checked)}
            />
            <span>
              <strong>Ignore encumbrance</strong>
              <span className="buff-desc">
                Keep weight visible but ignore load penalties and restrictions.
              </span>
            </span>
          </label>
        </>
      )}
      {step === 1 && (
        <>
          <div className="field">
            <span>Ancestry</span>
            <select
              aria-label="Ancestry"
              value={raceKey}
              onChange={(event) => {
                setRaceKey(event.target.value);
                setAlternateTraits([]);
                setRaceBonusFeat("");
              }}
            >
              {raceOptions.map(([key, option]) => (
                <option key={key} value={key}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div className="guide-choice-list">
            <article>
              <strong>Standard racial traits</strong>
              <small>
                {race?.size} · {race?.speed} ft. speed
              </small>
              <small>
                {[
                  ...new Set(
                    (activeRace.traits ?? []).map((trait) => trait.source),
                  ),
                ].join(" · ") || "Standard traits apply automatically."}
              </small>
            </article>
            <article>
              <strong>Racial choices</strong>
              <small>
                {hasFlexibleAbility
                  ? "Choose a flexible ability bonus below."
                  : "Fixed ability adjustments apply automatically."}
              </small>
              <small>
                {hasRaceBonusFeat
                  ? "Choose your racial bonus feat in the Feats step."
                  : "No racial bonus feat required."}
              </small>
            </article>
          </div>
          {!!race?.alternateTraits?.length && (
            <div className="field">
              <span>Alternate racial traits</span>
              <div className="guide-choice-list">
                {race.alternateTraits.map((trait) => (
                  <label key={trait.id}>
                    <input
                      type="checkbox"
                      checked={alternateTraits.includes(trait.id)}
                      onChange={() =>
                        setAlternateTraits((previous) =>
                          previous.includes(trait.id)
                            ? previous.filter((id) => id !== trait.id)
                            : [...previous, trait.id],
                        )
                      }
                    />
                    <span>
                      <strong>{trait.name}</strong>
                      <small>{trait.description}</small>
                      <small>
                        Replaces:{" "}
                        {trait.replaces?.join(", ") || "No standard traits"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {hasFlexibleAbility ? (
            <div className="field">
              <span>Ancestry ability bonus</span>
              <div className="ability-picker">
                {ABILITIES.map((ability) => (
                  <label
                    className={`pick ${flexibleAbility === ability ? "on" : ""}`}
                    key={ability}
                  >
                    <input
                      type="radio"
                      name="creation-flexible-ability"
                      checked={flexibleAbility === ability}
                      onChange={() => setFlexibleAbility(ability)}
                    />
                    +{race?.choiceOptions?.flexibleAbilityBonus?.value ?? 2}{" "}
                    {ability.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
      {step === 2 && (
        <>
          <div className="field">
            <span>Base ability scores</span>
            <p>
              PF1e point-buy cost:{" "}
              {pointBuy ?? "Scores outside point-buy range"}
              {creationRules?.method === "point-buy"
                ? ` / ${creationRules.pointBuyBudget}`
                : ""}{" "}
              (before ancestry bonuses).
            </p>
            {warnings.map((warning) => (
              <p role="status" key={warning}>
                {warning}
              </p>
            ))}
            <div className="ability-picker">
              {ABILITIES.map((ability) => (
                <label className="field compact" key={ability}>
                  <span>{ability.toUpperCase()}</span>
                  <input
                    type="number"
                    min={MIN_ABILITY_SCORE}
                    max={MAX_ABILITY_SCORE}
                    value={abilityScoreInputs[ability]}
                    onChange={(event) =>
                      updateAbility(ability, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            {!abilityScores ? (
              <p className="form-error">
                Enter a whole number from {MIN_ABILITY_SCORE} to{" "}
                {MAX_ABILITY_SCORE} for every ability.
              </p>
            ) : null}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="field">
            <span>Class</span>
            <select
              aria-label="Class"
              value={className}
              onChange={(event) => {
                setClassName(event.target.value);
                setArchetypes([]);
                setSelectedFeats([]);
                setMagicChoices({});
              }}
            >
              {RUNTIME_CLASS_OPTIONS.map((option) => {
                const allowed = classAllowsAlignment(
                  RUNTIME_CLASSES[classKeyForName(option.name)]!,
                  alignment,
                  { ignoreAlignmentRestrictions },
                );
                return (
                  <option
                    key={option.name}
                    value={option.name}
                    disabled={!allowed}
                  >
                    {option.name} · d{option.hitDie}
                    {allowed ? "" : " · alignment restricted"}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="guide-policy">
            <strong>{classDefinition?.name}</strong> · d
            {classDefinition?.hitDie} hit die ·{" "}
            {classDefinition?.skillRanksPerLevel} base skill ranks per level
          </div>
          {!!classArchetypeOptions.length && (
            <details className="field guide-archetypes">
              <summary>
                Archetypes · optional · {archetypes.length} selected
              </summary>
              <input
                type="search"
                aria-label="Search archetypes"
                placeholder="Search archetypes…"
                value={archetypeSearch}
                onChange={(event) => setArchetypeSearch(event.target.value)}
              />
              <div className="guide-choice-list">
                {classArchetypeOptions
                  .filter((archetype) =>
                    archetype.name
                      .toLowerCase()
                      .includes(archetypeSearch.toLowerCase()),
                  )
                  .map((archetype) => (
                    <label key={archetype.id}>
                      <input
                        type="checkbox"
                        aria-label={archetype.name}
                        checked={archetypes.includes(archetype.id)}
                        onChange={() =>
                          setArchetypes((current) =>
                            current.includes(archetype.id)
                              ? current.filter((id) => id !== archetype.id)
                              : [...current, archetype.id],
                          )
                        }
                      />
                      <span>
                        <strong>{archetype.name}</strong>
                        <small>{archetype.description}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </details>
          )}
          <div className="field">
            <span>Favored class bonus</span>
            <FavoredClassBonusPicker
              options={creationFavoredClassBonusOptions}
              value={favoredClass}
              detailValue={favoredClassSelection}
              radioName="creation-favored-class"
              onChange={setFavoredClass}
              onDetailChange={setFavoredClassSelection}
            />
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <div className="field">
            <span>
              Skill ranks — {remainingSkills} of {skillPoints} left
              <span className="muted"> (class skills marked C)</span>
            </span>
            <div className="skill-picker">
              {SKILL_DEFINITIONS.map((skill) => {
                const selected = selectedSkills.has(skill.key);
                return (
                  <label
                    className={`pick ${selected ? "on" : ""}`}
                    key={skill.key}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selected && remainingSkills <= 0}
                      onChange={() => toggleSkill(skill.key)}
                    />
                    {skill.name} {classSkills.has(skill.key) ? "· C" : ""}
                  </label>
                );
              })}
            </div>
          </div>

          {draftBuild && (
            <section className="creation-section">
              <h3>Languages</h3>
              <LanguageFields
                build={draftBuild}
                value={languages}
                onChange={setLanguages}
              />
            </section>
          )}
        </>
      )}
      {step === 5 && (
        <>
          {featSlots.map((slot, slotIndex) => {
            const selected = selectedFeats[slotIndex] ?? "";
            return (
              <label className="field" key={`${slot.source}-${slotIndex}`}>
                <span>{slot.label}</span>
                <FeatSelectionPicker
                  value={selected}
                  onChange={(value) =>
                    setSelectedFeats((previous) => {
                      const next = Array.from(
                        { length: featSlots.length },
                        (_, index) => previous[index] ?? "",
                      );
                      next[slotIndex] = value;
                      return next;
                    })
                  }
                  featRegistry={RUNTIME_FEATS}
                  grantKind={slot.kind}
                  availableWeaponNames={availableWeaponNames}
                  allowedOptions={resolveFeatOptions(slot.kind, selected)}
                  placeholder="Type to search legal feats"
                />
              </label>
            );
          })}

          {hasRaceBonusFeat ? (
            <label className="field">
              <span>{race?.name} bonus feat</span>
              <FeatSelectionPicker
                value={raceBonusFeat}
                onChange={setRaceBonusFeat}
                featRegistry={RUNTIME_FEATS}
                grantKind="general"
                availableWeaponNames={availableWeaponNames}
                allowedOptions={resolveFeatOptions("general", raceBonusFeat)}
                placeholder="Type to search legal feats"
              />
            </label>
          ) : null}

          <CreationMagicChoices
            build={draftBuild}
            onChange={setMagicChoices}
            value={magicChoices}
          />
        </>
      )}
      {step === 6 && (
        <>
          <div className="field">
            <span>Campaign Traits · optional</span>
            <p>
              Choose up to {traitLimit} campaign traits. They remain editable on
              Build.
            </p>
            {creationRules?.campaignTraitOptions ? (
              <div className="guide-choice-list">
                {creationRules.campaignTraitOptions.map((trait) => (
                  <label key={trait}>
                    <input
                      type="checkbox"
                      checked={campaignTraits.includes(trait)}
                      disabled={
                        !campaignTraits.includes(trait) &&
                        campaignTraits.length >= traitLimit
                      }
                      onChange={() =>
                        setCampaignTraits((previous) =>
                          previous.includes(trait)
                            ? previous.filter((name) => name !== trait)
                            : [...previous, trait],
                        )
                      }
                    />
                    <span>
                      <strong>{trait}</strong>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <>
                <div className="creation-campaign-traits">
                  {campaignTraits.map((trait, index) => (
                    <div className="inline-row" key={`creation-trait-${index}`}>
                      <input
                        aria-label={`Campaign trait ${index + 1}`}
                        value={trait}
                        placeholder="Campaign trait"
                        onChange={(event) =>
                          setCampaignTraits((current) =>
                            current.map((value, traitIndex) =>
                              traitIndex === index ? event.target.value : value,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() =>
                          setCampaignTraits((current) =>
                            current.filter(
                              (_, traitIndex) => traitIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ghost small"
                    disabled={campaignTraits.length >= traitLimit}
                    onClick={() =>
                      setCampaignTraits((current) => [...current, ""])
                    }
                  >
                    + Add campaign trait
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {step === 7 && (
        <>
          <dl className="guide-review">
            <div>
              <dt>Favored class bonus</dt>
              <dd>
                {creationFavoredClassBonusOptions.find(
                  (option) => option.value === favoredClass,
                )?.label ?? "None"}
                {favoredClassSelection ? ` · ${favoredClassSelection}` : ""}
              </dd>
            </div>
            <div>
              <dt>Foundation</dt>
              <dd>
                {characterName} · {alignment.replaceAll("-", " ")}
              </dd>
            </div>
            <div>
              <dt>Race & class</dt>
              <dd>
                {race?.name} · {classDefinition?.name} 1
                {archetypes.length ? " · " + archetypes.join(", ") : ""}
              </dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>
                {[...selectedSkills]
                  .map(
                    (key) =>
                      SKILL_DEFINITIONS.find((skill) => skill.key === key)
                        ?.name ?? key,
                  )
                  .join(", ") || "None assigned"}
              </dd>
            </div>
            <div>
              <dt>Feats</dt>
              <dd>
                {[raceBonusFeat, ...selectedFeats].filter(Boolean).join(", ") ||
                  "None selected"}
              </dd>
            </div>
            <div>
              <dt>Campaign traits</dt>
              <dd>
                {campaignTraits.filter(Boolean).join(", ") || "None selected"}
              </dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>
                {[
                  ...(languages.starting ?? []),
                  ...(languages.learned ?? []),
                ].join(", ") || "Automatic racial languages"}
              </dd>
            </div>
          </dl>
          {startingPlans.length > 0 && (
            <div className="guide-policy">
              <strong>Starting magic</strong>
              <ul>
                {startingPlans.map((plan) => (
                  <li key={`${plan.classKey}:${plan.level}:${plan.mode}`}>
                    Level {plan.level}{" "}
                    {plan.mode === "library" ? "spellbook" : plan.mode}:{" "}
                    {plan.spells.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!magicChoices.spellDomains?.cleric?.length && (
            <p className="guide-policy">
              Domains: {magicChoices.spellDomains.cleric.join(", ")}
            </p>
          )}
          {warnings.map((warning) => (
            <p className="guide-policy" key={warning}>
              {warning}
            </p>
          ))}
          {previewSheet ? (
            <section className="modal-preview">
              <div className="modal-preview-header">
                <strong>Level 1 preview</strong>
                <span className="muted">
                  {race?.name} · {classDefinition?.name}
                </span>
              </div>
              <div className="modal-preview-grid">
                <div className="modal-preview-card">
                  <div className="modal-preview-label">Hit Points</div>
                  <div className="modal-preview-value">
                    {previewSheet.hitPoints.total}
                  </div>
                  <div className="modal-preview-note">
                    Maximum d{classDefinition?.hitDie} at level 1
                  </div>
                </div>
                <div className="modal-preview-card">
                  <div className="modal-preview-label">Armor Class</div>
                  <div className="modal-preview-value">
                    {previewSheet.ac.normal.total}
                  </div>
                </div>
                <div className="modal-preview-card">
                  <div className="modal-preview-label">BAB</div>
                  <div className="modal-preview-value">
                    +{previewSheet.baseAttackBonus}
                  </div>
                </div>
                <div className="modal-preview-card">
                  <div className="modal-preview-label">Feats</div>
                  <div className="modal-preview-value">
                    {[raceBonusFeat, ...selectedFeats].filter(Boolean).length}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </CharacterGuide>
  );
}
