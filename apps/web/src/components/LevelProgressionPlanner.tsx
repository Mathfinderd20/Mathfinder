import type { AbilityKey, CharacterBuild } from "@mathfinder/rules-engine";
import type {
  LevelPlannerSuggestions,
  PlannerSuggestionChoice,
  PlannerSuggestionNote,
} from "../buildSuggestions";
import { featSlotTag, plannedFeatSlotsForLevel } from "../featSlots";
import { CompendiumPicker, type CompendiumOption } from "./CompendiumPicker";

interface LevelProgressionPlannerProps {
  build: CharacterBuild;
  currentLevel: number;
  abilityOrder: readonly AbilityKey[];
  classOptions: Array<{ name: string; hitDie: number }>;
  featOptions: CompendiumOption[];
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
  onClearPlannedLevelChoices: (levelIndex: number) => void;
}

function suggestionTone(choice: PlannerSuggestionChoice<string>) {
  return choice.emphasis ?? "ok";
}

function SuggestionButtons<T extends string>(props: {
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
        {choices.map((choice, index) => {
          const active =
            selectedValue?.trim().toLowerCase() ===
            choice.value.trim().toLowerCase();
          return (
            <button
              key={`${choice.value}-${choice.reason}`}
              type="button"
              className={`ghost tiny planner-suggestion-chip planner-suggestion-card ${active ? "active" : ""} tone-${suggestionTone(choice as PlannerSuggestionChoice<string>)}`}
              onClick={() => onApply(choice.value)}
            >
              <span className="planner-suggestion-card-head">
                <span className="planner-suggestion-rank">#{index + 1}</span>
                {choice.sourceLabel ? (
                  <span className="planner-suggestion-source">
                    {choice.sourceLabel}
                  </span>
                ) : null}
                {choice.sourceKind ? (
                  <span className="planner-suggestion-kind">
                    {choice.sourceKind}
                  </span>
                ) : null}
              </span>
              <span className="planner-suggestion-card-label">
                {choice.label}
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
      <div className="planner-suggestions planner-suggestions-rich">
        {choices.map((choice, index) => (
          <div
            key={`${choice.value}-${choice.reason}`}
            className={`planner-suggestion-card tone-${suggestionTone(choice)}`}
          >
            <span className="planner-suggestion-card-head">
              <span className="planner-suggestion-rank">#{index + 1}</span>
              {choice.sourceLabel ? (
                <span className="planner-suggestion-source">
                  {choice.sourceLabel}
                </span>
              ) : null}
              {choice.sourceKind ? (
                <span className="planner-suggestion-kind">
                  {choice.sourceKind}
                </span>
              ) : null}
            </span>
            <span className="planner-suggestion-card-label">
              {choice.label}
            </span>
            <span className="planner-suggestion-card-reason">
              {choice.reason}
            </span>
          </div>
        ))}
      </div>
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
  featOptions,
  plannerSuggestions,
  onEnsureLevelCount,
  onSetCurrentLevel,
  onUpdateLevelField,
  onSetLevelFeat,
  onApplyPlannerSuggestions,
  onClearPlannedLevelChoices,
}: LevelProgressionPlannerProps) {
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
        Plan the full progression, but only levels up to the current level are
        applied to the live sheet. Wild concept, I know.
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
            {Array.from({ length: PLANNER_LEVEL_CAP }, (_, index) => {
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
              const hitDie =
                classOptions.find(
                  (option) =>
                    option.name === (level?.className ?? defaultClass),
                )?.hitDie ?? 20;
              const suggestions = plannerSuggestions[index] ?? {
                guideChoices: [],
                classChoices: [],
                featChoices: [],
                favoredClassChoices: [],
                abilityChoices: [],
                notes: [],
              };
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
                        <SuggestionButtons
                          title="Recommended class picks"
                          choices={suggestions.classChoices}
                          selectedValue={level.className}
                          onApply={(value) =>
                            onUpdateLevelField(index, "className", value)
                          }
                        />
                      </>
                    ) : (
                      <span className="planner-empty">—</span>
                    )}
                  </td>
                  <td>
                    {isActive ? (
                      <input
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
                          const slotOptions = featOptions.filter(
                            (option) =>
                              slot.kind !== "fighter-bonus" ||
                              option.tags?.includes("combat"),
                          );
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
                              <CompendiumPicker
                                value={selectedFeat}
                                onChange={(value) =>
                                  onSetLevelFeat(index, featIndex, value)
                                }
                                options={slotOptions}
                                placeholder="Search feat"
                              />
                              {featIndex === 0 ? (
                                <SuggestionButtons
                                  title="Recommended feat picks"
                                  choices={suggestions.featChoices}
                                  selectedValue={selectedFeat}
                                  onApply={(value) =>
                                    onSetLevelFeat(index, featIndex, value)
                                  }
                                />
                              ) : null}
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
                          value={level.favoredClass ?? ""}
                          onChange={(e) =>
                            onUpdateLevelField(
                              index,
                              "favoredClass",
                              (e.target.value || undefined) as
                                | "hp"
                                | "skill"
                                | undefined,
                            )
                          }
                        >
                          <option value="">None</option>
                          <option value="hp">HP</option>
                          <option value="skill">Skill</option>
                        </select>
                        <SuggestionButtons
                          title="Recommended favored bonus"
                          choices={suggestions.favoredClassChoices}
                          selectedValue={level.favoredClass ?? "none"}
                          onApply={(value) =>
                            onUpdateLevelField(
                              index,
                              "favoredClass",
                              value === "none" ? undefined : value,
                            )
                          }
                        />
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
                                | AbilityKey
                                | undefined,
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
                        <SuggestionButtons
                          title="Recommended ASI picks"
                          choices={suggestions.abilityChoices}
                          selectedValue={level.abilityIncrease ?? ""}
                          onApply={(value) =>
                            onUpdateLevelField(index, "abilityIncrease", value)
                          }
                        />
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
                          onClick={() => onClearPlannedLevelChoices(index)}
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
                    <SuggestionPreviewList
                      title="Guide read"
                      choices={suggestions.guideChoices}
                    />
                    <SuggestionNotes notes={suggestions.notes} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
