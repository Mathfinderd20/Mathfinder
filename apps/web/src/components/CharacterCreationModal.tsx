import { LanguageFields } from "./CharacterLanguages";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildCharacter,
  deriveLanguages,
  classAllowsAlignment,
  computeSheet,
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
import { buildFavoredClassBonusOptions } from "../favoredClassBonusData";
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
  const deferredAbilityScores = useDeferredValue(abilityScores);
  const warnings =
    creationRules && abilityScores
      ? creationWarnings(
          ABILITIES.map((ability) => abilityScores[ability]),
          1,
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
  const [campaignTraits, setCampaignTraits] = useState<string[]>([]);

  const race =
    RUNTIME_RACE_OPTIONS.find(([key]) => key === raceKey)?.[1] ??
    raceOptions[0]?.[1];
  const classKey = classKeyForName(className);
  const classDefinition = RUNTIME_CLASSES[classKey];
  const resolvedRace = race ?? RUNTIME_RACE_OPTIONS[0]![1];
  const creationFavoredClassBonusOptions = buildFavoredClassBonusOptions(
    resolvedRace,
    className,
  );
  const hasFlexibleAbility = !!race?.choiceOptions?.flexibleAbilityBonus;
  const hasRaceBonusFeat = !!race?.choiceOptions?.bonusFeat;

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
        ignoreAlignmentRestrictions,
        ignoreEncumbrance,
      });
    },
    [
      alignment,
      characterName,
      classDefinition,
      favoredClass,
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
    () =>
      deferredAbilityScores ? createBuild(deferredAbilityScores) : undefined,
    [createBuild, deferredAbilityScores],
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
  const intelligenceScore =
    previewSheet?.abilities.int.score ??
    parseAbilityScoreInput(abilityScoreInputs.int) ??
    10;
  const intelligenceModifier = Math.floor((intelligenceScore - 10) / 2);
  const extraRaceSkillRanks = race?.choiceOptions?.extraSkillRanksPerLevel ?? 0;
  const skillPoints = Math.max(
    1,
    (classDefinition?.skillRanksPerLevel ?? 0) +
      intelligenceModifier +
      extraRaceSkillRanks,
  );
  const remainingSkills = skillPoints - selectedSkills.size;
  const classSkills = new Set(classDefinition?.classSkills ?? []);

  useEffect(() => {
    setSelectedSkills(
      (previous) => new Set([...previous].slice(0, skillPoints)),
    );
  }, [skillPoints]);

  useEffect(() => {
    setSelectedFeats((previous) => previous.slice(0, featSlots.length));
  }, [featSlots.length]);

  useEffect(() => {
    if (!hasRaceBonusFeat) setRaceBonusFeat("");
  }, [hasRaceBonusFeat]);

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
  const canConfirm =
    !!draftBuild &&
    (languages.starting?.length ?? 0) <=
      deriveLanguages(draftBuild).startingCapacity &&
    (languages.learned?.length ?? 0) <=
      deriveLanguages(draftBuild).learnedCapacity &&
    classAlignmentAllowed &&
    remainingSkills >= 0 &&
    !missingRequiredFeat;

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
    <div className="modal-backdrop">
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Create {characterName.trim() || "Unnamed Hero"} · Level 1</h2>
        <p className="hint">
          Make the decisions that define the character now. Everything remains
          editable later on the Build page.
        </p>

        <div className="field">
          <span>Ancestry</span>
          <select
            value={raceKey}
            onChange={(event) => setRaceKey(event.target.value)}
          >
            {raceOptions.map(([key, option]) => (
              <option key={key} value={key}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

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

        <div className="field">
          <span>Class</span>
          <select
            value={className}
            onChange={(event) => setClassName(event.target.value)}
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

        <div className="field">
          <span>Base ability scores</span>
          <p>
            PF1e point-buy cost: {pointBuy ?? "Scores outside point-buy range"}
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

        {featSlots.map((slot, slotIndex) => {
          const selected = selectedFeats[slotIndex] ?? "";
          return (
            <label className="field" key={`${slot.source}-${slotIndex}`}>
              <span>{slot.label}</span>
              <FeatSelectionPicker
                value={selected}
                onChange={(value) =>
                  setSelectedFeats((previous) => {
                    const next = [...previous];
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

        <div className="field">
          <span>Favored class bonus</span>
          <div className="ability-picker">
            {creationFavoredClassBonusOptions.map((option) => {
              const value = option.value || undefined;
              return (
                <label
                  className={`pick ${favoredClass === value ? "on" : ""}`}
                  key={option.value || "none"}
                  title={option.description}
                >
                  <input
                    type="radio"
                    name="creation-favored-class"
                    checked={favoredClass === value}
                    onChange={() => setFavoredClass(value)}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="field">
          <span>Campaign Traits · optional</span>
          <p>
            Add up to three campaign-specific traits when the GM’s creation
            rules allow them. They remain editable on Build.
          </p>
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
                      current.filter((_, traitIndex) => traitIndex !== index),
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
              disabled={campaignTraits.length >= 3}
              onClick={() => setCampaignTraits((current) => [...current, ""])}
            >
              + Add campaign trait
            </button>
          </div>
        </div>

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
        {!classAlignmentAllowed ? (
          <p className="form-error">
            {classDefinition?.alignmentRestriction?.description}
          </p>
        ) : null}
        {missingRequiredFeat ? (
          <p className="form-error">
            Choose every granted feat before continuing.
          </p>
        ) : null}
        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onClose}>
            Back
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              const finalBuild = abilityScores
                ? createBuild(abilityScores)
                : undefined;
              if (finalBuild)
                onConfirm(
                  { ...finalBuild, languages },
                  {
                    campaignTraits: campaignTraits
                      .map((trait) => trait.trim())
                      .filter(Boolean),
                  },
                );
            }}
          >
            Create Character
          </button>
        </div>
      </div>
    </div>
  );
}
