import type {
  AbilityKey,
  CharacterBuild,
  FirearmRulesMode,
  SkillKey,
} from "@mathfinder/rules-engine";
import { useMemo, useState } from "react";
import type {
  LevelPlannerSuggestions,
  PlannerSuggestionChoice,
  SkillSuggestionChoice,
} from "../buildSuggestions";

const WIZARD_STEPS = ["Basics", "Stats", "Class Lane", "Tune-up"] as const;

type WizardStep = (typeof WIZARD_STEPS)[number];

function SuggestionStrip<T extends string>(props: {
  title: string;
  choices: PlannerSuggestionChoice<T>[];
  selectedValue?: string;
  onApply: (value: T) => void;
}) {
  const { title, choices, selectedValue, onApply } = props;
  if (choices.length === 0) return null;
  return (
    <div className="planner-suggestion-stack">
      <div className="planner-suggestion-stack-title">{title}</div>
      <div className="planner-suggestions planner-suggestions-rich">
        {choices.slice(0, 4).map((choice, index) => {
          const active =
            selectedValue?.trim().toLowerCase() ===
            choice.value.trim().toLowerCase();
          return (
            <button
              key={`${choice.value}-${choice.reason}`}
              type="button"
              className={`ghost tiny planner-suggestion-chip planner-suggestion-card ${active ? "active" : ""}`}
              title={choice.reason}
              onClick={() => onApply(choice.value)}
            >
              <span className="planner-suggestion-card-head">
                <span className="planner-suggestion-rank">#{index + 1}</span>
                <span>{choice.label}</span>
              </span>
              <span className="planner-suggestion-card-reason">
                {choice.reason}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  build: CharacterBuild;
  currentLevel: number;
  abilityOrder: readonly AbilityKey[];
  raceOptions: [string, CharacterBuild["race"]][];
  classOptions: Array<{ name: string }>;
  plannerSuggestions: LevelPlannerSuggestions[];
  currentLevelSkillSuggestions: SkillSuggestionChoice[];
  onUpdateName: (name: string) => void;
  onUpdateRace: (raceKey: string) => void;
  onUpdateFavoredClassName: (value: string) => void;
  onUpdateFirearmRulesMode: (value: FirearmRulesMode) => void;
  onSetCurrentLevel: (level: number) => void;
  onUpdateBaseAbilityScore: (ability: AbilityKey, value: number) => void;
  onUpdateRaceFlexibleAbility: (ability: AbilityKey) => void;
  onUpdateLevelField: <K extends keyof CharacterBuild["levels"][number]>(
    levelIndex: number,
    key: K,
    value: CharacterBuild["levels"][number][K],
  ) => void;
  onUpdateLevelSkillRank: (
    levelIndex: number,
    skillKey: SkillKey,
    value: number,
  ) => void;
  onApplyPlannerSuggestions: (levelIndex: number) => void;
}

export function GuidedBuildWizard(props: Props) {
  const {
    build,
    currentLevel,
    abilityOrder,
    raceOptions,
    classOptions,
    plannerSuggestions,
    currentLevelSkillSuggestions,
    onUpdateName,
    onUpdateRace,
    onUpdateFavoredClassName,
    onUpdateFirearmRulesMode,
    onSetCurrentLevel,
    onUpdateBaseAbilityScore,
    onUpdateRaceFlexibleAbility,
    onUpdateLevelField,
    onUpdateLevelSkillRank,
    onApplyPlannerSuggestions,
  } = props;
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = WIZARD_STEPS[stepIndex] as WizardStep;
  const levelIndex = Math.max(0, currentLevel - 1);
  const level = build.levels[levelIndex];
  const suggestions = plannerSuggestions[levelIndex] ?? {
    guideChoices: [],
    classChoices: [],
    featChoices: [],
    featChoicesBySlot: [],
    favoredClassChoices: [],
    abilityChoices: [],
    notes: [],
  };
  const raceChoiceAbilities =
    build.race.choiceOptions?.flexibleAbilityBonus?.abilities ?? abilityOrder;
  const raceKey =
    raceOptions.find(([, race]) => race.name === build.race.name)?.[0] ??
    raceOptions[0]?.[0] ??
    "human";
  const completion = useMemo(() => {
    const checks = [
      !!build.name.trim(),
      !!raceKey,
      !!level?.className,
      !!build.favoredClassName,
      abilityOrder.every((ability) => build.baseAbilityScores[ability] > 0),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [
    abilityOrder,
    build.baseAbilityScores,
    build.favoredClassName,
    build.name,
    level?.className,
    raceKey,
  ]);

  return (
    <section className="panel build-panel">
      <div className="editor-section-head">
        <h2>Guided Build Wizard</h2>
        <span className="skill-builder-meta">
          Step {stepIndex + 1}/{WIZARD_STEPS.length} · ~{completion}% seeded
        </span>
      </div>
      <p className="hint">
        Fast path for the obvious choices. The full crunchy editor is still
        below when you want to micromanage every pebble.
      </p>
      <div className="ability-picker">
        {WIZARD_STEPS.map((step, index) => (
          <button
            key={step}
            type="button"
            className={`pick ${index === stepIndex ? "on" : ""}`}
            onClick={() => setStepIndex(index)}
          >
            {step}
          </button>
        ))}
      </div>

      {currentStep === "Basics" ? (
        <div className="item-card">
          <div className="editor-grid">
            <label className="field compact">
              <span>Name</span>
              <input
                type="text"
                value={build.name}
                onChange={(event) =>
                  onUpdateName(event.target.value || "Unnamed Hero")
                }
              />
            </label>
            <label className="field compact">
              <span>Race</span>
              <select
                value={raceKey}
                onChange={(event) => onUpdateRace(event.target.value)}
              >
                {raceOptions.map(([key, race]) => (
                  <option key={key} value={key}>
                    {race.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field compact">
              <span>Current level</span>
              <select
                value={currentLevel}
                onChange={(event) =>
                  onSetCurrentLevel(Number(event.target.value) || 1)
                }
              >
                {build.levels.map((_, index) => (
                  <option key={`wizard-level-${index + 1}`} value={index + 1}>
                    L{index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="field compact">
              <span>Firearm rules</span>
              <select
                value={build.campaignRules?.firearmRules ?? "standard"}
                onChange={(event) =>
                  onUpdateFirearmRulesMode(
                    event.target.value as FirearmRulesMode,
                  )
                }
              >
                <option value="standard">Standard</option>
                <option value="guns-everywhere">Guns Everywhere</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {currentStep === "Stats" ? (
        <div className="item-card">
          <div className="editor-grid">
            {abilityOrder.map((ability) => (
              <label
                className="field compact"
                key={`wizard-ability-${ability}`}
              >
                <span>{ability.toUpperCase()}</span>
                <input
                  type="number"
                  min={1}
                  value={build.baseAbilityScores[ability]}
                  onChange={(event) =>
                    onUpdateBaseAbilityScore(
                      ability,
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                />
              </label>
            ))}
          </div>
          {build.race.choiceOptions?.flexibleAbilityBonus ? (
            <div className="field compact">
              <span>Flexible racial bonus</span>
              <div className="ability-picker">
                {raceChoiceAbilities.map((ability) => {
                  const active =
                    build.race.choiceSelection?.flexibleAbility === ability;
                  return (
                    <button
                      key={`wizard-race-bonus-${ability}`}
                      type="button"
                      className={`pick ${active ? "on" : ""}`}
                      onClick={() => onUpdateRaceFlexibleAbility(ability)}
                    >
                      {ability.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <SuggestionStrip
            title="Suggested ability bumps later"
            choices={suggestions.abilityChoices}
            selectedValue={level?.abilityIncrease}
            onApply={(value) =>
              onUpdateLevelField(levelIndex, "abilityIncrease", value)
            }
          />
        </div>
      ) : null}

      {currentStep === "Class Lane" ? (
        <div className="item-card">
          <div className="editor-grid">
            <label className="field compact">
              <span>Class at L{currentLevel}</span>
              <select
                value={level?.className ?? classOptions[0]?.name ?? "Fighter"}
                onChange={(event) =>
                  onUpdateLevelField(
                    levelIndex,
                    "className",
                    event.target.value,
                  )
                }
              >
                {classOptions.map((option) => (
                  <option
                    key={`wizard-class-${option.name}`}
                    value={option.name}
                  >
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field compact">
              <span>Favored class</span>
              <select
                value={build.favoredClassName ?? ""}
                onChange={(event) =>
                  onUpdateFavoredClassName(event.target.value)
                }
              >
                <option value="">None</option>
                {classOptions.map((option) => (
                  <option
                    key={`wizard-favored-${option.name}`}
                    value={option.name}
                  >
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <SuggestionStrip
            title="Recommended class picks"
            choices={suggestions.classChoices}
            selectedValue={level?.className}
            onApply={(value) =>
              onUpdateLevelField(levelIndex, "className", value)
            }
          />
          <SuggestionStrip
            title="Recommended favored class"
            choices={suggestions.favoredClassChoices}
            selectedValue={build.favoredClassName ?? "none"}
            onApply={(value) =>
              onUpdateFavoredClassName(value === "none" ? "" : value)
            }
          />
        </div>
      ) : null}

      {currentStep === "Tune-up" ? (
        <div className="item-card">
          <div className="editor-section-head tight">
            <h3>Current level polish</h3>
            <button
              className="ghost small"
              type="button"
              onClick={() => onApplyPlannerSuggestions(levelIndex)}
            >
              Apply planner suggestions
            </button>
          </div>
          {currentLevelSkillSuggestions.length > 0 ? (
            <div className="planner-suggestions">
              {currentLevelSkillSuggestions.slice(0, 6).map((suggestion) => {
                const currentRanks = level?.skillRanks?.[suggestion.key] ?? 0;
                return (
                  <button
                    key={`wizard-skill-${suggestion.key}`}
                    type="button"
                    className="ghost tiny planner-suggestion-chip"
                    title={suggestion.reason}
                    onClick={() =>
                      onUpdateLevelSkillRank(
                        levelIndex,
                        suggestion.key,
                        currentRanks + 1,
                      )
                    }
                  >
                    + {suggestion.key}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="hint">No urgent skill nudges here. Miraculous.</p>
          )}
          {suggestions.notes.length > 0 ? (
            <ul className="planner-suggestion-notes compact">
              {suggestions.notes.slice(0, 4).map((note) => (
                <li key={`${note.label}-${note.text}`}>
                  {note.label}: {note.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="planner-builder-controls">
        <button
          className="ghost small"
          type="button"
          disabled={stepIndex <= 0}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          Back
        </button>
        <button
          className="ghost small"
          type="button"
          disabled={stepIndex >= WIZARD_STEPS.length - 1}
          onClick={() =>
            setStepIndex((index) =>
              Math.min(WIZARD_STEPS.length - 1, index + 1),
            )
          }
        >
          Next
        </button>
      </div>
    </section>
  );
}
