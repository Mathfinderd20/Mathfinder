import type { AbilityKey, CharacterBuild } from "@mathfinder/rules-engine";
import { useMemo, useState } from "react";
import type {
  LevelPlannerSuggestions,
  PlannerSuggestionChoice,
  PlannerSuggestionNote,
} from "../buildSuggestions";
import { featSlotTag, plannedFeatSlotsForLevel } from "../featSlots";
import { buildFavoredClassBonusOptions } from "../favoredClassBonusData";
import { collectFeatWeaponNames } from "../featOptionData";
import { RUNTIME_FEATS, RUNTIME_WEAPONS } from "../content";
import { FeatSelectionPicker } from "./FeatSelectionPicker";

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
}: LevelProgressionPlannerProps) {
  const availableWeaponNames = useMemo(
    () => collectFeatWeaponNames(build, RUNTIME_WEAPONS),
    [build],
  );
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>(
    {},
  );

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
                const grantsFeat = featSlots.length > 0;
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
                return (
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
                          {featSlots.map((slot, featIndex) => {
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
                            {rowExpanded ? "Hide Tips" : "Show Tips"}
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
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
