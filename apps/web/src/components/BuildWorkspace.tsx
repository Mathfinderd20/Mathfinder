import { type ReactNode } from "react";
import { ALIGNMENT_LABELS } from "@mathfinder/rules-engine";
import type { BuildEditorProps } from "./BuildEditorTab";
import { LevelProgressionPlanner } from "./LevelProgressionPlanner";
import { CharacterDialog } from "./CharacterDialog";
import { useCharacterUiState } from "../features/characters/CharacterUiSession";
import { classAbilitiesGrantedAtLevel } from "../classAbilityProgression";
import { RUNTIME_CLASS_FEATURES, RUNTIME_ARCHETYPES } from "../content";
import { sign } from "../util";

export function buildClassProgression(
  levels: BuildEditorProps["build"]["levels"],
) {
  const counts = new Map<string, number>();
  return levels.map((level) => {
    const count = (counts.get(level.className) ?? 0) + 1;
    counts.set(level.className, count);
    return count;
  });
}
export function BuildWorkspace(
  props: BuildEditorProps & { renderDetails: (section: string) => ReactNode },
) {
  const { build, characterId = "local" } = props;
  const [editor, setEditor] = useCharacterUiState<string | null>(
    characterId,
    "build-detail",
    null,
  );
  const [expanded, setExpanded] = useCharacterUiState<Record<number, boolean>>(
    characterId,
    "build-levels",
    {},
  );
  const [allOpen, setAllOpen] = useCharacterUiState(
    characterId,
    "build-progression-open",
    true,
  );
  const counts = buildClassProgression(build.levels);
  const appliedLevels = build.levels.slice(0, props.currentLevel);
  const summary = [...new Set(appliedLevels.map((level) => level.className))]
    .map(
      (name) =>
        `${name} ${appliedLevels.filter((level) => level.className === name).length}`,
    )
    .join(" / ");
  const choices = build.race.choiceSelection;
  const alternate = (build.race.alternateTraits ?? []).filter((trait) =>
    choices?.alternateTraits?.some(
      (id) => id.toLowerCase() === trait.id.toLowerCase(),
    ),
  );
  const replaced = new Set(
    alternate
      .flatMap((trait) => trait.replaces ?? [])
      .map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "")),
  );
  const raceTraits = [
    ...(build.race.traits ?? []).filter(
      (trait) =>
        !replaced.has(trait.source.toLowerCase().replace(/[^a-z0-9]/g, "")),
    ),
    ...alternate.flatMap((trait) => trait.traits ?? []),
  ];
  const raceSources = [...new Set(raceTraits.map((trait) => trait.source))];
  const racialAdjustments = [
    ...(build.race.abilityModifiers ?? []),
    ...alternate.flatMap((trait) => trait.abilityModifiers ?? []),
  ];
  return (
    <main className="workspace-v2 build-v2">
      <section className="v2-panel build-v2-summary">
        <div>
          <span className="character-eyebrow">Character progression</span>
          <h2>
            Level {props.currentLevel} · {summary}
          </h2>
          <p>
            {build.race.name} ·{" "}
            {build.alignment
              ? ALIGNMENT_LABELS[build.alignment]
              : "Alignment not set"}
          </p>
        </div>
        <div className="build-score-strip">
          {props.abilityOrder.map((ability) => (
            <span key={ability}>
              <small>{ability.toUpperCase()}</small>
              <strong>{build.baseAbilityScores[ability]}</strong>
            </span>
          ))}
        </div>
        <div className="build-v2-actions">
          <button className="ghost" onClick={() => setEditor("foundation")}>
            Edit foundation
          </button>
          <button className="ghost" onClick={() => setEditor("skills")}>
            Skill ranks
          </button>
          {props.advancementActions}
        </div>
      </section>
      <div className="build-v2-foundation">
        <section className="v2-panel build-race-record">
          <header className="v2-panel-heading">
            <div>
              <span className="character-eyebrow">
                Creation choice · editable
              </span>
              <h2>Race</h2>
            </div>
            <button
              className="ghost small"
              onClick={() => setEditor("foundation")}
            >
              Modify race
            </button>
          </header>
          <div className="build-foundation-record">
            <strong>{build.race.name}</strong>
            <span>
              {build.race.size} · {build.race.speed} ft
            </span>
          </div>
          <div className="build-racial-traits">
            {!!racialAdjustments.length && (
              <div>
                <strong>Ability adjustments</strong>
                <span>
                  {racialAdjustments
                    .map(
                      (modifier) =>
                        `${modifier.target.replace("ability.", "").toUpperCase()} ${sign(modifier.value)}`,
                    )
                    .join(" · ")}
                </span>
              </div>
            )}
            {raceSources.map((source) => (
              <div key={source}>
                <strong>{source}</strong>
                <span>
                  {raceTraits
                    .filter((trait) => trait.source === source)
                    .map(
                      (trait) =>
                        `${trait.target.replaceAll(".", " ")} ${sign(trait.value)}${trait.condition ? ` (${trait.condition})` : ""}`,
                    )
                    .join(" · ")}
                </span>
              </div>
            ))}
            {choices?.flexibleAbility && (
              <div>
                <strong>Flexible ability</strong>
                <span>{choices.flexibleAbility.toUpperCase()} selected</span>
              </div>
            )}
            {choices?.bonusFeat && (
              <div>
                <strong>Bonus feat</strong>
                <span>{choices.bonusFeat}</span>
              </div>
            )}
            {alternate.map((trait) => (
              <div key={trait.id}>
                <strong>{trait.name}</strong>
                <span>
                  {trait.description || "Selected alternate racial trait"}
                </span>
              </div>
            ))}
            {(build.race.notes ?? []).map((note, index) => (
              <div key={index}>
                <span>{note}</span>
              </div>
            ))}
            {!build.race.notes?.length &&
              !racialAdjustments.length &&
              !raceTraits.length &&
              !alternate.length &&
              !choices?.flexibleAbility &&
              !choices?.bonusFeat && (
                <p className="v2-empty">
                  No additional racial choices recorded.
                </p>
              )}
          </div>
        </section>
        <div className="build-campaign-traits">
          {props.campaignTraitsPanel ?? (
            <section className="v2-panel">
              <header className="v2-panel-heading">
                <h2>Campaign Traits</h2>
              </header>
              <p className="v2-empty">No campaign traits recorded.</p>
            </section>
          )}
        </div>
      </div>
      <section className="v2-panel build-progression">
        <header className="v2-panel-heading">
          <div>
            <span className="character-eyebrow">
              Top to bottom · every level expands
            </span>
            <h2>Level progression</h2>
          </div>
          <div className="v2-inline-actions">
            <button
              className="ghost small"
              onClick={() =>
                props.onEnsureLevelCount(Math.min(20, build.levels.length + 1))
              }
              disabled={build.levels.length >= 20}
            >
              + Plan next level
            </button>
            <button
              className="ghost small"
              onClick={() => setEditor("progression")}
            >
              Plan through 20
            </button>
            <button
              className="ghost small"
              aria-label={
                allOpen
                  ? "Collapse level progression"
                  : "Expand level progression"
              }
              onClick={() => setAllOpen(!allOpen)}
            >
              {allOpen ? "−" : "+"}
            </button>
          </div>
        </header>
        {allOpen && (
          <div className="build-progression-list">
            {build.levels.map((level, index) => {
              const abilities = classAbilitiesGrantedAtLevel({
                build,
                levelIndex: index,
                classFeatures: RUNTIME_CLASS_FEATURES,
                archetypes: RUNTIME_ARCHETYPES,
              });
              return (
                <section className="build-level-record" key={index}>
                  <div className="build-level-line">
                    <button
                      className="build-level-toggle"
                      aria-expanded={!!expanded[index]}
                      onClick={() =>
                        setExpanded({ ...expanded, [index]: !expanded[index] })
                      }
                    >
                      <span className="build-level-index">
                        Level {index + 1}
                        <small>
                          {index + 1 > props.currentLevel
                            ? "Planned"
                            : "Applied"}
                        </small>
                      </span>
                      <strong>{level.className}</strong>
                      <span>
                        {level.className} {counts[index]}
                      </span>
                      <small>
                        {[
                          ...abilities.map((value) => value.name),
                          ...(level.feats ?? []).filter(Boolean),
                          `${level.hitPointRoll} HP`,
                        ].join(" · ")}
                      </small>
                      <em>{expanded[index] ? "−" : "+"}</em>
                    </button>
                    <button
                      className="ghost small"
                      onClick={() => {
                        setExpanded({ ...expanded, [index]: true });
                        props.onRequestPlannerSuggestions(index);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  {expanded[index] && (
                    <div className="build-level-breakdown">
                      <LevelProgressionPlanner {...props} focusLevel={index} />
                      <button
                        className="ghost small"
                        onClick={() => {
                          props.onSetCurrentLevel(index + 1);
                          setEditor("skills");
                        }}
                      >
                        Review skill ranks at level {index + 1}
                      </button>
                      <p className="v2-footnote">
                        Changes recalculate this build and its later levels.
                        Inventory, notes, and character identity stay with this
                        character.
                      </p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
      <p className="v2-footnote">
        Level Up advances the character. Planning and editing retain the
        existing validation and guided suggestions.
      </p>
      {editor && (
        <CharacterDialog label="Build editor" onClose={() => setEditor(null)}>
          <section className="modal v2-editor-dialog">
            <header className="modal-head">
              <div>
                <span className="character-eyebrow">Character build</span>
                <h2>
                  {editor === "foundation"
                    ? "Foundation & racial choices"
                    : editor === "skills"
                      ? "Skill ranks"
                      : "Progression planner"}
                </h2>
              </div>
              <button className="ghost" onClick={() => setEditor(null)}>
                Done
              </button>
            </header>
            {props.renderDetails(editor)}
          </section>
        </CharacterDialog>
      )}
    </main>
  );
}
