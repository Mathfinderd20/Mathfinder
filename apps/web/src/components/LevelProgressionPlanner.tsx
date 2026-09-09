import type { AbilityKey, CharacterBuild } from "@mathfinder/rules-engine";
import { useMemo, useState } from "react";
import type {
  LevelPlannerSuggestions,
  PlannerSuggestionChoice,
  PlannerSuggestionNote,
} from "../buildSuggestions";
import { featSlotTag, plannedFeatSlotsForLevel } from "../featSlots";
import { buildFavoredClassBonusOptions } from "../favoredClassBonusData";
import { collectFeatWeaponNames, collectFirearmNames } from "../featOptionData";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_FEATS,
  RUNTIME_WEAPONS,
} from "../content";
import { classAbilitiesGrantedAtLevel } from "../classAbilityProgression";
import { FeatSelectionPicker } from "./FeatSelectionPicker";
import { CompendiumPicker } from "./CompendiumPicker";
import { effectiveRaceChoiceOptions } from "../skillRankProgression";
import { sign } from "../util";

interface LevelProgressionPlannerProps {
  build: CharacterBuild;
  currentLevel: number;
  abilityOrder: readonly AbilityKey[];
  classOptions: Array<{ name: string; hitDie: number }>;
  plannerSuggestions: LevelPlannerSuggestions[];
  onEnsureLevelCount: (count: number) => void;
  onSetCurrentLevel: (level: number) => void;
  onUpdateLevelField: <K extends keyof CharacterBuild["levels"][number]>(
    levelIndex: number,
    key: K,
    value: CharacterBuild["levels"][number][K],
  ) => void;
  onSetLevelFeat: (
    levelIndex: number,
    featIndex: number,
    value: string,
  ) => void;
  onApplyPlannerSuggestions: (levelIndex: number) => void;
  onRequestPlannerSuggestions: (levelIndex: number) => void;
  onClearPlannedLevelChoices: (levelIndex: number) => void;
  onUpdateInfantrymanGunTraining: (weaponName: string) => void;
}

function SuggestionPreviewList({
  title,
  choices,
}: {
  title: string;
  choices: PlannerSuggestionChoice<string>[];
}) {
  if (choices.length === 0) return null;
  return (
    <div className="planner-suggestion-stack">
      <div className="planner-suggestion-stack-title">{title}</div>
      <ul className="planner-compact-summary">
        {choices.slice(0, 3).map((choice, index) => (
          <li key={`${choice.value}-${choice.reason}`}>
            #{index + 1} {choice.label}
            {choice.reason ? ` — ${choice.reason}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionNotes({ notes }: { notes: PlannerSuggestionNote[] }) {
  if (notes.length === 0) return <span className="planner-empty">—</span>;
  return (
    <ul className="planner-suggestion-notes planner-suggestion-notes-rich">
      {notes.map((note) => (
        <li key={`${note.label}-${note.text}`}>
          <span className="planner-note-label">{note.label}</span>
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  );
}

const PLANNER_LEVEL_CAP = 20;

export function LevelProgressionPlanner({
  build,
  currentLevel,
  abilityOrder,
  classOptions,
  plannerSuggestions,
  onEnsureLevelCount,
  onSetCurrentLevel,
  onUpdateLevelField,
  onSetLevelFeat,
  onApplyPlannerSuggestions,
  onRequestPlannerSuggestions,
  onClearPlannedLevelChoices,
  onUpdateInfantrymanGunTraining,
}: LevelProgressionPlannerProps) {
  const raceOptions = effectiveRaceChoiceOptions(build.race);
  const alternateTraits = (build.race.alternateTraits ?? []).filter((trait) =>
    build.race.choiceSelection?.alternateTraits?.some(
      (id) => id.toLowerCase() === trait.id.toLowerCase(),
    ),
  );
  const racialAbilityModifiers = [
    ...(build.race.abilityModifiers ?? []),
    ...alternateTraits.flatMap((trait) => trait.abilityModifiers ?? []),
  ];
  const availableWeaponNames = useMemo(
    () => collectFeatWeaponNames(build, RUNTIME_WEAPONS),
    [build],
  );
  const firearmNames = useMemo(
    () => collectFirearmNames(build, RUNTIME_WEAPONS),
    [build],
  );
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>(
    () => ({ [Math.max(0, currentLevel - 1)]: true }),
  );
  const [expandedAbilityLevels, setExpandedAbilityLevels] = useState<
    Record<number, boolean>
  >({});

  return (
    <section className="planner-shell">
      <div className="editor-section-head">
        <h3>Level Progression Planner</h3>
        <div className="planner-actions">
          <label className="field compact">
            <span>Current level</span>
            <select
              value={currentLevel}
              onChange={(e) => onSetCurrentLevel(Number(e.target.value) || 1)}
            >
              {Array.from(
                { length: build.levels.length },
                (_, index) => index + 1,
              ).map((level) => (
                <option key={`current-level-${level}`} value={level}>
                  L{level}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ghost small"
            onClick={() => onEnsureLevelCount(20)}
          >
            Fill to 20
          </button>
        </div>
      </div>
      <p className="hint">
        Plan the full progression, but keep each row lean: the controls live in
        the row, and the suggestions stay off to the side unless you ask for
        more.
      </p>
      <div className="planner-table-wrap">
        <table className="planner-table">
          <thead>
            <tr>
              <th>Lvl</th>
              <th>Status</th>
              <th>Class</th>
              <th>Class Abilities</th>
              <th>HP</th>
              <th>Feats</th>
              <th>Favored Bonus</th>
              <th>ASI</th>
              <th>Action</th>
              <th>Suggestions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PLANNER_LEVEL_CAP }, (_, index) => index).map(
              (index) => {
                const levelNumber = index + 1;
                const level = build.levels[index];
                const isActive = !!level;
                const isApplied = levelNumber <= currentLevel;
                const featSlots = isActive
                  ? plannedFeatSlotsForLevel(build, index)
                  : [];
                const grantsAbilityIncrease = levelNumber % 4 === 0;
                const defaultClass =
                  build.levels[index - 1]?.className ??
                  build.levels[build.levels.length - 1]?.className ??
                  classOptions[0]?.name ??
                  "Fighter";
                const levelClassName = level?.className ?? defaultClass;
                const favoredClassEligible =
                  !!build.favoredClassName &&
                  build.favoredClassName.toLowerCase() ===
                    levelClassName.toLowerCase();
                const favoredClassBonusOptions = buildFavoredClassBonusOptions(
                  build.race,
                  levelClassName,
                ).filter((option) => favoredClassEligible || !option.value);
                const hitDie =
                  classOptions.find(
                    (option) =>
                      option.name === (level?.className ?? defaultClass),
                  )?.hitDie ?? 20;
                const suggestions = plannerSuggestions[index] ?? {
                  guideChoices: [],
                  classChoices: [],
                  featChoices: [],
                  featChoicesBySlot: [],
                  favoredClassChoices: [],
                  abilityChoices: [],
                  notes: [],
                };
                const rowExpanded = !!expandedLevels[index];
                const hasGuidedSuggestions =
                  suggestions.guideChoices.length > 0;
                const classAbilities = isActive
                  ? classAbilitiesGrantedAtLevel({
                      build,
                      levelIndex: index,
                      classFeatures: RUNTIME_CLASS_FEATURES,
                      archetypes: RUNTIME_ARCHETYPES,
                    })
                  : [];
                const abilitiesExpanded = !!expandedAbilityLevels[index];
                const classAbilityFeatSlotIndex = classAbilities.some(
                  (ability) => ability.name.toLowerCase() === "bonus feat",
                )
                  ? featSlots.findIndex(
                      (slot) =>
                        slot.label.toLowerCase() ===
                        `${levelClassName.toLowerCase()} bonus feat`,
                    )
                  : -1;
                const visibleFeatSlots = featSlots
                  .map((slot, featIndex) => ({ slot, featIndex }))
                  .filter(
                    ({ featIndex }) => featIndex !== classAbilityFeatSlotIndex,
                  );
                const grantsFeat = visibleFeatSlots.length > 0;
                if (!rowExpanded) {
                  const featSummary = (level?.feats ?? [])
                    .map((feat) => feat.trim())
                    .filter(Boolean)
                    .join(" · ");
                  const abilitySummary = classAbilities
                    .map((ability) => ability.name)
                    .join(" · ");
                  return [
                    <tr
                      key={`planner-row-${index + 1}`}
                      className={`planner-level-summary-row ${
                        isActive ? (isApplied ? "active" : "future") : "future"
                      }`}
                    >
                      <td colSpan={10}>
                        <div className="planner-level-summary-content">
                          <span className="planner-level-number">
                            Level <strong>{levelNumber}</strong>
                          </span>
                          <span className="planner-level-class">
                            <strong>{levelClassName}</strong>
                            <small>
                              {isActive
                                ? isApplied
                                  ? "Current"
                                  : "Planned"
                                : "Empty"}
                            </small>
                          </span>
                          <span className="planner-level-gains">
                            {[
                              abilitySummary,
                              featSummary,
                              isActive
                                ? `${level?.hitPointRoll ?? 0} HP`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No choices recorded"}
                          </span>
                          <button
                            className="ghost small"
                            type="button"
                            onClick={() => {
                              onRequestPlannerSuggestions(index);
                              setExpandedLevels((previous) => ({
                                ...previous,
                                [index]: true,
                              }));
                            }}
                          >
                            Edit
                          </button>
                          <span className="planner-level-expand-mark">+</span>
                        </div>
                      </td>
                    </tr>,
                  ];
                }
                return [
                  <tr
                    key={`planner-row-${index + 1}`}
                    className={
                      isActive ? (isApplied ? "active" : "future") : "future"
                    }
                  >
                    <td>{levelNumber}</td>
                    <td>
                      {isActive ? (isApplied ? "Current" : "Planned") : "Empty"}
                    </td>
                    <td>
                      {isActive ? (
                        <>
                          <select
                            value={level.className}
                            onChange={(e) =>
                              onUpdateLevelField(
                                index,
                                "className",
                                e.target.value,
                              )
                            }
                          >
                            {classOptions.map((option) => (
                              <option key={option.name} value={option.name}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                    <td className="planner-class-abilities-cell">
                      {classAbilities.length > 0 ? (
                        <button
                          className="planner-ability-toggle"
                          type="button"
                          aria-expanded={abilitiesExpanded}
                          title={classAbilities
                            .map((ability) => ability.name)
                            .join(", ")}
                          onClick={() =>
                            setExpandedAbilityLevels((previous) => ({
                              ...previous,
                              [index]: !previous[index],
                            }))
                          }
                        >
                          <span>{classAbilities[0]?.name}</span>
                          {classAbilities.length > 1 ? (
                            <span className="planner-ability-count">
                              +{classAbilities.length - 1}
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                    <td>
                      {isActive ? (
                        <input
                          className="planner-hp-input"
                          type="number"
                          min={1}
                          max={hitDie}
                          value={level.hitPointRoll}
                          onChange={(e) =>
                            onUpdateLevelField(
                              index,
                              "hitPointRoll",
                              Math.max(1, Number(e.target.value) || 1),
                            )
                          }
                        />
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                    <td>
                      {isActive && grantsFeat ? (
                        <div className="planner-feat-slots">
                          {visibleFeatSlots.map(({ slot, featIndex }) => {
                            const selectedFeat = level.feats?.[featIndex] ?? "";
                            return (
                              <div
                                key={`${levelNumber}-${slot.source}-${featIndex}`}
                                className="planner-feat-slot"
                              >
                                <span className="planner-slot-label">
                                  {slot.label}
                                  <span className="planner-slot-meta">
                                    {featSlotTag(slot.kind)}
                                  </span>
                                </span>
                                <FeatSelectionPicker
                                  value={selectedFeat}
                                  onChange={(value) =>
                                    onSetLevelFeat(index, featIndex, value)
                                  }
                                  featRegistry={RUNTIME_FEATS}
                                  grantKind={slot.kind}
                                  availableWeaponNames={availableWeaponNames}
                                  placeholder="Feat"
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                    <td>
                      {isActive ? (
                        <>
                          <select
                            value={
                              favoredClassEligible
                                ? (level.favoredClass ?? "")
                                : ""
                            }
                            disabled={!favoredClassEligible}
                            title={
                              favoredClassEligible
                                ? "Favored-class bonus"
                                : `${level.className} is not the build's favored class.`
                            }
                            onChange={(e) =>
                              onUpdateLevelField(
                                index,
                                "favoredClass",
                                e.target.value || undefined,
                              )
                            }
                          >
                            {favoredClassBonusOptions.map((option) => (
                              <option
                                key={option.value || "none"}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                    <td>
                      {isActive && grantsAbilityIncrease ? (
                        <>
                          <select
                            value={level.abilityIncrease ?? ""}
                            onChange={(e) =>
                              onUpdateLevelField(
                                index,
                                "abilityIncrease",
                                (e.target.value || undefined) as
                                  AbilityKey | undefined,
                              )
                            }
                          >
                            <option value="">None</option>
                            {abilityOrder.map((ability) => (
                              <option key={ability} value={ability}>
                                {ability.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                    <td>
                      {isActive ? (
                        <div className="planner-row-actions">
                          {isApplied ? (
                            <button
                              className="ghost small"
                              onClick={() =>
                                onSetCurrentLevel(Math.max(1, index))
                              }
                            >
                              Set Before
                            </button>
                          ) : (
                            <button
                              className="ghost small"
                              onClick={() => onSetCurrentLevel(index + 1)}
                            >
                              Apply to Here
                            </button>
                          )}
                          <button
                            className="ghost small"
                            onClick={() => onApplyPlannerSuggestions(index)}
                          >
                            Apply Top Picks
                          </button>
                          <button
                            className="ghost small"
                            type="button"
                            onClick={() => {
                              if (!rowExpanded)
                                onRequestPlannerSuggestions(index);
                              setExpandedLevels((prev) => ({
                                ...prev,
                                [index]: !prev[index],
                              }));
                            }}
                          >
                            {rowExpanded ? "Close Level" : "Edit Level"}
                          </button>
                          <button
                            className="ghost small"
                            onClick={() => {
                              onClearPlannedLevelChoices(index);
                              setExpandedLevels((prev) => ({
                                ...prev,
                                [index]: false,
                              }));
                            }}
                          >
                            Clear Picks
                          </button>
                        </div>
                      ) : (
                        <button
                          className="ghost small"
                          onClick={() => onEnsureLevelCount(index + 1)}
                        >
                          Plan to Here
                        </button>
                      )}
                    </td>
                    <td>
                      {rowExpanded ? (
                        <>
                          <SuggestionPreviewList
                            title="Guide read"
                            choices={suggestions.guideChoices}
                          />
                          <SuggestionPreviewList
                            title="Class"
                            choices={suggestions.classChoices}
                          />
                          <SuggestionPreviewList
                            title="Feats"
                            choices={suggestions.featChoices}
                          />
                          <SuggestionPreviewList
                            title="Favored bonus"
                            choices={suggestions.favoredClassChoices}
                          />
                          <SuggestionPreviewList
                            title="Ability increase"
                            choices={suggestions.abilityChoices}
                          />
                          <SuggestionNotes notes={suggestions.notes} />
                        </>
                      ) : hasGuidedSuggestions ? (
                        <div className="planner-compact-note-count">
                          Guided tips ready
                        </div>
                      ) : (
                        <span className="planner-empty">—</span>
                      )}
                    </td>
                  </tr>,
                  rowExpanded ? (
                    <tr
                      key={`planner-racial-details-${index}`}
                      className="planner-ability-detail-row"
                    >
                      <td colSpan={10}>
                        <div className="planner-racial-details">
                          <strong>
                            {build.race.name} · Racial build adjustments
                          </strong>
                          {index === 0 ? (
                            <>
                              {racialAbilityModifiers.map((modifier, i) => (
                                <span key={i}>
                                  {modifier.target.toUpperCase()}{" "}
                                  {sign(modifier.value)}
                                </span>
                              ))}
                              {raceOptions.flexibleAbilityBonus &&
                              build.race.choiceSelection?.flexibleAbility ? (
                                <span>
                                  Flexible racial bonus:{" "}
                                  {build.race.choiceSelection.flexibleAbility.toUpperCase()}{" "}
                                  {sign(raceOptions.flexibleAbilityBonus.value)}
                                </span>
                              ) : null}
                              {build.race.choiceSelection?.bonusFeat ? (
                                <span>
                                  Bonus feat:{" "}
                                  {build.race.choiceSelection.bonusFeat}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                          <span>
                            Extra skill ranks this level:{" "}
                            {sign(
                              Math.max(
                                0,
                                raceOptions.extraSkillRanksPerLevel ?? 0,
                              ),
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                  abilitiesExpanded ? (
                    <tr
                      key={`planner-ability-detail-${index + 1}`}
                      className="planner-ability-detail-row"
                    >
                      <td colSpan={10}>
                        <div className="planner-ability-detail-grid">
                          {classAbilities.map((ability) => {
                            const isGunTraining =
                              levelClassName.toLowerCase() === "infantryman" &&
                              ability.name.toLowerCase() === "gun training";
                            const isBonusFeat =
                              ability.name.toLowerCase() === "bonus feat" &&
                              classAbilityFeatSlotIndex >= 0;
                            return (
                              <article
                                className="planner-ability-card"
                                key={ability.id}
                              >
                                <div className="planner-ability-card-head">
                                  <strong>{ability.name}</strong>
                                  <span>{ability.source}</span>
                                </div>
                                <p>{ability.description}</p>
                                {isGunTraining ? (
                                  <label className="field compact">
                                    <span>Trained firearm</span>
                                    <CompendiumPicker
                                      value={
                                        build.gunTrainingSelections
                                          ?.infantryman?.[0] ?? ""
                                      }
                                      onChange={onUpdateInfantrymanGunTraining}
                                      options={firearmNames.map((name) => ({
                                        id: `planner-gun-training-${name.toLowerCase()}`,
                                        name,
                                        tooltip: `Gun Training: add Dexterity to damage with ${name}.`,
                                      }))}
                                      placeholder="Choose trained firearm"
                                      commitMode="select"
                                      maxResults={40}
                                    />
                                  </label>
                                ) : null}
                                {isBonusFeat ? (
                                  <label className="field compact">
                                    <span>Select bonus feat</span>
                                    <FeatSelectionPicker
                                      value={
                                        level?.feats?.[
                                          classAbilityFeatSlotIndex
                                        ] ?? ""
                                      }
                                      onChange={(value) =>
                                        onSetLevelFeat(
                                          index,
                                          classAbilityFeatSlotIndex,
                                          value,
                                        )
                                      }
                                      featRegistry={RUNTIME_FEATS}
                                      grantKind={
                                        featSlots[classAbilityFeatSlotIndex]
                                          ?.kind ?? "general"
                                      }
                                      availableWeaponNames={
                                        availableWeaponNames
                                      }
                                      placeholder="Choose bonus feat"
                                    />
                                  </label>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
