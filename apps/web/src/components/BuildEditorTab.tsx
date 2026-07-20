import {
  SKILL_DEFINITIONS,
  type AbilityKey,
  type ArchetypeDefinitionLike,
  type CharacterBuild,
  type DerivedSpellcasting,
  type FirearmRulesMode,
  type SkillKey,
} from "@mathfinder/rules-engine";
import { useMemo, useState, type ReactNode } from "react";
import { featTitle } from "../rulesText";
import type { SpellCastCounts } from "../runtimeState";
import { LevelProgressionPlanner } from "./LevelProgressionPlanner";
import { GuidedBuildWizard } from "./GuidedBuildWizard";
import type {
  LevelPlannerSuggestions,
  SkillSuggestionChoice,
  SpellSuggestionChoice,
} from "../buildSuggestions";
import { CompendiumPicker, type CompendiumOption } from "./CompendiumPicker";
import { SpellcastingManager } from "./SpellcastingManager";
import { Tooltip } from "./Tooltip";

type SpellMode = "prepared" | "known";

function effectiveRaceChoiceOptions(race: CharacterBuild["race"]) {
  const selectedIds = new Set(
    (race.choiceSelection?.alternateTraits ?? []).map((id) => id.toLowerCase()),
  );
  const activeTraits = (race.alternateTraits ?? []).filter((trait) =>
    selectedIds.has(trait.id.toLowerCase()),
  );
  const next = { ...(race.choiceOptions ?? {}) };
  for (const trait of activeTraits) {
    for (const key of trait.removeChoiceOptions ?? []) delete next[key];
    if (trait.choiceOptions?.flexibleAbilityBonus !== undefined)
      next.flexibleAbilityBonus = trait.choiceOptions.flexibleAbilityBonus;
    if (trait.choiceOptions?.bonusFeat !== undefined)
      next.bonusFeat = trait.choiceOptions.bonusFeat;
    if (trait.choiceOptions?.extraSkillRanksPerLevel !== undefined)
      next.extraSkillRanksPerLevel =
        trait.choiceOptions.extraSkillRanksPerLevel;
  }
  return next;
}

interface Props {
  build: CharacterBuild;
  currentLevel: number;
  sheetSpellcasting: DerivedSpellcasting[];
  abilityOrder: readonly AbilityKey[];
  raceOptions: [string, CharacterBuild["race"]][];
  classOptions: Array<{
    name: string;
    hitDie: number;
    skillRanksPerLevel: number;
  }>;
  archetypeOptionsByClass: Record<string, ArchetypeDefinitionLike[]>;
  featOptions: CompendiumOption[];
  plannerSuggestions: LevelPlannerSuggestions[];
  currentLevelSkillSuggestions: SkillSuggestionChoice[];
  currentLevelSkillNotes: string[];
  spellSuggestions: Record<
    string,
    Partial<Record<number, SpellSuggestionChoice[]>>
  >;
  skillName: Map<string, string>;
  spellOptions: Array<{ id: string; name: string }>;
  domainOptions: Array<{ id: string; name: string }>;
  schoolOptions: Array<{ id: string; name: string }>;
  spellCastCounts: SpellCastCounts;
  onUpdateName: (name: string) => void;
  onUpdateBaseAbilityScore: (ability: AbilityKey, value: number) => void;
  onUpdateRace: (raceKey: string) => void;
  onUpdateRaceFlexibleAbility: (ability: AbilityKey) => void;
  onUpdateRaceBonusFeat: (featName: string) => void;
  onToggleRaceAlternateTrait: (traitId: string) => void;
  onUpdateFavoredClassName: (value: string) => void;
  onUpdateFirearmRulesMode: (value: FirearmRulesMode) => void;
  onUpdateClassArchetypes: (className: string, archetypeIds: string[]) => void;
  onAddStructureLevel: () => void;
  onEnsureLevelCount: (count: number) => void;
  onSetCurrentLevel: (level: number) => void;
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
  onSetLevelFeat: (
    levelIndex: number,
    featIndex: number,
    value: string,
  ) => void;
  onApplyPlannerSuggestions: (levelIndex: number) => void;
  onClearPlannedLevelChoices: (levelIndex: number) => void;
  onAddSelection: (classKey: string, mode: SpellMode, level: number) => void;
  onAppendSelection: (
    classKey: string,
    mode: SpellMode,
    level: number,
    spellName: string,
  ) => void;
  onUpdateSelectionName: (
    classKey: string,
    mode: SpellMode,
    level: number,
    index: number,
    value: string,
  ) => void;
  onRemoveSelection: (
    classKey: string,
    mode: SpellMode,
    level: number,
    index: number,
  ) => void;
  onResetSelectionsForLevel: (
    classKey: string,
    mode: SpellMode,
    level: number,
  ) => void;
  onResetSelectionsForClass: (
    classKey: string,
    mode: SpellMode,
    levels: number[],
  ) => void;
  onAddLibraryEntry: (classKey: string, level: number) => void;
  onAppendLibraryEntry: (
    classKey: string,
    level: number,
    spellName: string,
  ) => void;
  onUpdateLibraryName: (
    classKey: string,
    level: number,
    index: number,
    value: string,
  ) => void;
  onRemoveLibraryEntry: (
    classKey: string,
    level: number,
    index: number,
  ) => void;
  onResetLibraryLevel: (classKey: string, level: number) => void;
  onResetLibraryForClass: (classKey: string, levels: number[]) => void;
  onFillSelectionsFromLibrary: (
    classKey: string,
    mode: SpellMode,
    level: number,
    capacity: number,
  ) => void;
  onUpdateDomains: (classKey: string, index: number, value: string) => void;
  onUpdateSpecialization: (classKey: string, value: string) => void;
  onAdjustExtraSpellSlots: (
    classKey: string,
    level: number,
    delta: number,
  ) => void;
  onAdjustSpellSlot: (
    classKey: string,
    level: number,
    max: number,
    delta: number,
  ) => void;
  onCastSpell: (
    classKey: string,
    level: number,
    max: number,
    spellName: string,
    remaining: number,
  ) => void;
  onResetSpellSlotLevel: (classKey: string, level: number) => void;
  onResetSpellRuntimeClass: (classKey: string, levels: number[]) => void;
}

export function BuildEditorTab(props: Props) {
  const {
    build,
    currentLevel,
    sheetSpellcasting,
    abilityOrder,
    raceOptions,
    classOptions,
    archetypeOptionsByClass,
    featOptions,
    plannerSuggestions,
    currentLevelSkillSuggestions,
    currentLevelSkillNotes,
    spellSuggestions,
    skillName,
    spellOptions,
    domainOptions,
    schoolOptions,
    spellCastCounts,
  } = props;

  const [plannerOpen, setPlannerOpen] = useState(true);
  const currentLevelIndex = Math.max(0, currentLevel - 1);
  const currentLevelEntry = build.levels[currentLevelIndex];
  const raceChoiceOptions = effectiveRaceChoiceOptions(build.race);
  const raceBonusFeatOptions = useMemo(() => {
    const allowed = raceChoiceOptions.bonusFeat?.featOptions;
    if (!allowed?.length) return featOptions;
    const allowedSet = new Set(allowed.map((feat) => feat.toLowerCase()));
    return featOptions.filter((option) =>
      allowedSet.has(option.name.toLowerCase()),
    );
  }, [featOptions, raceChoiceOptions.bonusFeat?.featOptions]);

  return (
    <div className="build-page">
      <GuidedBuildWizard
        build={build}
        currentLevel={currentLevel}
        abilityOrder={abilityOrder}
        raceOptions={raceOptions}
        classOptions={classOptions}
        plannerSuggestions={plannerSuggestions}
        currentLevelSkillSuggestions={currentLevelSkillSuggestions}
        onUpdateName={props.onUpdateName}
        onUpdateRace={props.onUpdateRace}
        onUpdateFavoredClassName={props.onUpdateFavoredClassName}
        onUpdateFirearmRulesMode={props.onUpdateFirearmRulesMode}
        onSetCurrentLevel={props.onSetCurrentLevel}
        onUpdateBaseAbilityScore={props.onUpdateBaseAbilityScore}
        onUpdateRaceFlexibleAbility={props.onUpdateRaceFlexibleAbility}
        onUpdateLevelField={props.onUpdateLevelField}
        onUpdateLevelSkillRank={props.onUpdateLevelSkillRank}
        onApplyPlannerSuggestions={props.onApplyPlannerSuggestions}
      />
      <section className="panel build-panel">
        <h2>Build Editor</h2>
        <p className="hint">
          This is the crunchy tab. Character construction lives here now; all
          the inventory hoarding got kicked to Gear.
        </p>

        <label className="field compact">
          <span>Name</span>
          <input
            type="text"
            value={build.name}
            onChange={(e) =>
              props.onUpdateName(e.target.value || "Unnamed Hero")
            }
          />
        </label>

        <div className="editor-grid">
          {abilityOrder.map((ability) => (
            <label className="field compact" key={ability}>
              <span>{ability.toUpperCase()}</span>
              <input
                type="number"
                min={1}
                value={build.baseAbilityScores[ability]}
                onChange={(e) =>
                  props.onUpdateBaseAbilityScore(
                    ability,
                    Number(e.target.value) || 1,
                  )
                }
              />
            </label>
          ))}
        </div>

        <div className="editor-section-head">
          <h3>Race & Level Structure</h3>
          <button className="ghost small" onClick={props.onAddStructureLevel}>
            Add Level
          </button>
        </div>
        <div className="editor-grid">
          <label className="field compact">
            <span>Race</span>
            <select
              value={
                raceOptions.find(
                  ([, race]) => race.name === build.race.name,
                )?.[0] ?? "human"
              }
              onChange={(e) => props.onUpdateRace(e.target.value)}
            >
              {raceOptions.map(([key, race]) => (
                <option key={key} value={key}>
                  {race.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact">
            <span>Favored class</span>
            <select
              value={build.favoredClassName ?? ""}
              onChange={(e) => props.onUpdateFavoredClassName(e.target.value)}
            >
              <option value="">None</option>
              {classOptions.map((option) => (
                <option key={`favored-${option.name}`} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact">
            <span>Firearm rules</span>
            <select
              value={build.campaignRules?.firearmRules ?? "standard"}
              onChange={(e) =>
                props.onUpdateFirearmRulesMode(
                  e.target.value as FirearmRulesMode,
                )
              }
            >
              <option value="standard">Standard</option>
              <option value="guns-everywhere">Guns Everywhere</option>
            </select>
          </label>
        </div>
        {Object.keys(raceChoiceOptions).length > 0 ||
        build.race.alternateTraits?.length ? (
          <div className="item-card">
            <div className="editor-section-head tight">
              <h3>Race Choices</h3>
              <span className="skill-builder-meta">{build.race.name}</span>
            </div>
            <div className="editor-grid">
              {raceChoiceOptions.flexibleAbilityBonus ? (
                <label className="field compact">
                  <span>
                    Flexible +{raceChoiceOptions.flexibleAbilityBonus.value}
                  </span>
                  <select
                    value={build.race.choiceSelection?.flexibleAbility ?? ""}
                    onChange={(e) =>
                      props.onUpdateRaceFlexibleAbility(
                        e.target.value as AbilityKey,
                      )
                    }
                  >
                    {(
                      raceChoiceOptions.flexibleAbilityBonus.abilities ?? [
                        ...abilityOrder,
                      ]
                    ).map((ability) => (
                      <option key={`race-flex-${ability}`} value={ability}>
                        {ability.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {raceChoiceOptions.bonusFeat ? (
                <label className="field compact">
                  <span>Bonus feat</span>
                  <CompendiumPicker
                    value={build.race.choiceSelection?.bonusFeat ?? ""}
                    onChange={props.onUpdateRaceBonusFeat}
                    options={raceBonusFeatOptions}
                    placeholder="Search feat"
                    tooltip={featTitle(
                      build.race.choiceSelection?.bonusFeat ?? "",
                    )}
                  />
                </label>
              ) : null}
            </div>
            <div className="spell-sheet-meta">
              {raceChoiceOptions.extraSkillRanksPerLevel ? (
                <span className="chip">
                  Extra skill ranks/level: +
                  {raceChoiceOptions.extraSkillRanksPerLevel}
                </span>
              ) : null}
              {build.race.choiceSelection?.bonusFeat ? (
                <SearchableFeatChip
                  featName={build.race.choiceSelection.bonusFeat}
                />
              ) : null}
            </div>
            {build.race.alternateTraits?.length ? (
              <div className="race-alt-trait-list">
                {build.race.alternateTraits.map((trait) => {
                  const active = (
                    build.race.choiceSelection?.alternateTraits ?? []
                  ).some((id) => id.toLowerCase() === trait.id.toLowerCase());
                  return (
                    <label
                      key={`race-alt-${trait.id}`}
                      className={`pick ${active ? "on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          props.onToggleRaceAlternateTrait(trait.id)
                        }
                      />
                      <span>
                        <strong>{trait.name}</strong>
                        <span className="buff-desc">
                          {trait.description}
                          {trait.replaces?.length
                            ? ` Replaces: ${trait.replaces.join(", ")}.`
                            : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <EditorSection title="Class Archetypes">
          <div className="item-card">
            <div className="editor-section-head tight">
              <h3>Archetype Picks</h3>
              <span className="skill-builder-meta">Per class in build</span>
            </div>
            <div className="race-alt-trait-list">
              {[...new Set(build.levels.map((level) => level.className))]
                .sort((a, b) => a.localeCompare(b))
                .map((className) => {
                  const classKey = className.toLowerCase();
                  const archetypes = archetypeOptionsByClass[classKey] ?? [];
                  const selected = new Set(
                    (build.classArchetypes?.[classKey] ?? []).map((id) =>
                      id.toLowerCase(),
                    ),
                  );
                  return (
                    <div
                      key={`archetypes-${classKey}`}
                      className="item-card nested"
                    >
                      <div className="editor-section-head tight">
                        <h3>{className}</h3>
                        <span className="skill-builder-meta">
                          {archetypes.length} archetype
                          {archetypes.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {archetypes.length === 0 ? (
                        <p className="hint">
                          No runtime archetypes loaded for this class. Tragic,
                          but concise.
                        </p>
                      ) : (
                        <div className="race-alt-trait-list">
                          {archetypes.map((archetype) => {
                            const active = selected.has(
                              archetype.id.toLowerCase(),
                            );
                            return (
                              <label
                                key={`class-archetype-${classKey}-${archetype.id}`}
                                className={`pick ${active ? "on" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => {
                                    const next = new Set(selected);
                                    if (active)
                                      next.delete(archetype.id.toLowerCase());
                                    else next.add(archetype.id.toLowerCase());
                                    props.onUpdateClassArchetypes(className, [
                                      ...next,
                                    ]);
                                  }}
                                />
                                <span>
                                  <strong>{archetype.name}</strong>
                                  <span className="buff-desc">
                                    {archetype.description}
                                  </span>
                                  {archetype.replaces?.length ? (
                                    <span className="buff-desc">
                                      Replaces: {archetype.replaces.join(", ")}.
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </EditorSection>

        <section className="planner-builder">
          <div className="planner-builder-summary">
            <span className="subsection-title planner-builder-title">
              Level Progression Planner
            </span>
            <div className="planner-builder-controls">
              <span className="planner-builder-meta">
                Current L{currentLevel} · {build.levels.length}/20 planned
              </span>
              <button
                className="ghost small"
                type="button"
                onClick={() => setPlannerOpen((open) => !open)}
              >
                {plannerOpen ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>
          {plannerOpen ? (
            <LevelProgressionPlanner
              build={build}
              currentLevel={currentLevel}
              abilityOrder={abilityOrder}
              classOptions={classOptions}
              plannerSuggestions={plannerSuggestions}
              onEnsureLevelCount={props.onEnsureLevelCount}
              onSetCurrentLevel={props.onSetCurrentLevel}
              onUpdateLevelField={props.onUpdateLevelField}
              onSetLevelFeat={props.onSetLevelFeat}
              onApplyPlannerSuggestions={props.onApplyPlannerSuggestions}
              onClearPlannedLevelChoices={props.onClearPlannedLevelChoices}
            />
          ) : null}
        </section>

        <EditorSection title="Current Level Skill Ranks">
          {currentLevelEntry ? (
            <div className="item-card">
              <div className="editor-section-head tight">
                <h3>
                  Level {currentLevel} — {currentLevelEntry.className}
                </h3>
                <span className="skill-builder-meta">
                  {skillBudgetSummary(build, classOptions, currentLevelIndex)}
                </span>
              </div>
              {currentLevelSkillSuggestions.length > 0 ? (
                <>
                  <div className="planner-suggestions">
                    {currentLevelSkillSuggestions.map((suggestion) => {
                      const maxRanks = remainingSkillCapacity(
                        build,
                        suggestion.key,
                        currentLevelIndex,
                      );
                      const currentRanks =
                        currentLevelEntry.skillRanks?.[suggestion.key] ?? 0;
                      const { unallocated } = skillBudgetForLevel(
                        build,
                        classOptions,
                        currentLevelIndex,
                      );
                      const canApply =
                        unallocated > 0 && currentRanks < maxRanks;
                      return (
                        <button
                          key={`skill-suggestion-${suggestion.key}`}
                          type="button"
                          className="ghost tiny planner-suggestion-chip"
                          title={suggestion.reason}
                          disabled={!canApply}
                          onClick={() =>
                            props.onUpdateLevelSkillRank(
                              currentLevelIndex,
                              suggestion.key,
                              Math.min(maxRanks, currentRanks + 1),
                            )
                          }
                        >
                          + {skillName.get(suggestion.key) ?? suggestion.key}
                        </button>
                      );
                    })}
                  </div>
                  {currentLevelSkillNotes.length > 0 ? (
                    <ul className="planner-suggestion-notes compact">
                      {currentLevelSkillNotes.map((note) => (
                        <li key={`skill-note-${note}`}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
              <div className="skill-rank-table compact-skill-rank-table">
                {SKILL_DEFINITIONS.slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((skill) => {
                    const maxRanks = remainingSkillCapacity(
                      build,
                      skill.key,
                      currentLevelIndex,
                    );
                    return (
                      <div
                        className="skill-rank-row skill-rank-table-row"
                        key={`rank-${currentLevelIndex}-${skill.key}`}
                      >
                        <span className="skill-rank-label">
                          {skillName.get(skill.key) ?? skill.key}
                        </span>
                        <span className="skill-rank-meta" title="Ability">
                          {skill.ability.toUpperCase()}
                        </span>
                        <span className="skill-rank-flag" title="Trained only">
                          {skill.trainedOnly ? "T" : ""}
                        </span>
                        <span
                          className="skill-rank-flag"
                          title="Armor check penalty applies"
                        >
                          {skill.armorCheckPenalty ? "A" : ""}
                        </span>
                        <input
                          aria-label={`${skillName.get(skill.key) ?? skill.key} ranks`}
                          title={`Max here: ${maxRanks}`}
                          type="number"
                          min={0}
                          max={maxRanks}
                          step={1}
                          value={currentLevelEntry.skillRanks?.[skill.key] ?? 0}
                          onChange={(e) =>
                            props.onUpdateLevelSkillRank(
                              currentLevelIndex,
                              skill.key,
                              Math.max(
                                0,
                                Math.min(maxRanks, Number(e.target.value) || 0),
                              ),
                            )
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </EditorSection>

        <SpellcastingManager
          casters={sheetSpellcasting}
          classArchetypes={build.classArchetypes}
          spellOptions={spellOptions}
          domainOptions={domainOptions}
          schoolOptions={schoolOptions}
          spellCastCounts={spellCastCounts}
          spellSuggestions={spellSuggestions}
          onAddSelection={props.onAddSelection}
          onAppendSelection={props.onAppendSelection}
          onUpdateSelectionName={props.onUpdateSelectionName}
          onRemoveSelection={props.onRemoveSelection}
          onResetSelectionsForLevel={props.onResetSelectionsForLevel}
          onResetSelectionsForClass={props.onResetSelectionsForClass}
          onAddLibraryEntry={props.onAddLibraryEntry}
          onAppendLibraryEntry={props.onAppendLibraryEntry}
          onUpdateLibraryName={props.onUpdateLibraryName}
          onRemoveLibraryEntry={props.onRemoveLibraryEntry}
          onResetLibraryLevel={props.onResetLibraryLevel}
          onResetLibraryForClass={props.onResetLibraryForClass}
          onFillSelectionsFromLibrary={props.onFillSelectionsFromLibrary}
          onUpdateDomains={props.onUpdateDomains}
          onUpdateSpecialization={props.onUpdateSpecialization}
          onAdjustExtraSpellSlots={props.onAdjustExtraSpellSlots}
          onAdjustSpellSlot={props.onAdjustSpellSlot}
          onCastSpell={props.onCastSpell}
          onResetSpellSlotLevel={props.onResetSpellSlotLevel}
          onResetSpellRuntimeClass={props.onResetSpellRuntimeClass}
        />
      </section>
    </div>
  );
}

function allocatedSkillRanks(
  skillRanks: Partial<Record<SkillKey, number>> | undefined,
) {
  return Object.values(skillRanks ?? {}).reduce<number>(
    (sum, ranks) => sum + (ranks ?? 0),
    0,
  );
}

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2);
}

function racialAbilityBonus(build: CharacterBuild, ability: AbilityKey) {
  const fixedBonus = (build.race.abilityModifiers ?? []).reduce(
    (sum, mod) => (mod.target === ability ? sum + mod.value : sum),
    0,
  );
  const choiceOptions = effectiveRaceChoiceOptions(build.race);
  const flexibleBonus =
    choiceOptions.flexibleAbilityBonus &&
    build.race.choiceSelection?.flexibleAbility === ability
      ? choiceOptions.flexibleAbilityBonus.value
      : 0;
  return fixedBonus + flexibleBonus;
}

function intScoreAtLevel(build: CharacterBuild, levelIndex: number) {
  let score = build.baseAbilityScores.int + racialAbilityBonus(build, "int");
  for (let i = 0; i <= levelIndex; i += 1) {
    if (build.levels[i]?.abilityIncrease === "int") score += 1;
  }
  return score;
}

function skillBudgetForLevel(
  build: CharacterBuild,
  classOptions: Array<{
    name: string;
    hitDie: number;
    skillRanksPerLevel: number;
  }>,
  levelIndex: number,
) {
  const level = build.levels[levelIndex];
  if (!level) return { budget: 0, allocated: 0, unallocated: 0 };
  const baseRanks =
    classOptions.find((option) => option.name === level.className)
      ?.skillRanksPerLevel ?? 0;
  const intMod = abilityMod(intScoreAtLevel(build, levelIndex));
  const isFavoredClassLevel =
    !!build.favoredClassName &&
    level.className.toLowerCase() === build.favoredClassName.toLowerCase();
  const favoredSkill =
    isFavoredClassLevel && level.favoredClass === "skill" ? 1 : 0;
  const budget =
    Math.max(1, baseRanks + intMod) +
    favoredSkill +
    Math.max(
      0,
      effectiveRaceChoiceOptions(build.race).extraSkillRanksPerLevel ?? 0,
    );
  const allocated = allocatedSkillRanks(level.skillRanks);
  return { budget, allocated, unallocated: budget - allocated };
}

function totalSkillRanks(build: CharacterBuild, skillKey: SkillKey) {
  return build.levels.reduce(
    (sum, level) => sum + (level.skillRanks?.[skillKey] ?? 0),
    0,
  );
}

function remainingSkillCapacity(
  build: CharacterBuild,
  skillKey: SkillKey,
  levelIndex: number,
) {
  const currentLevelRanks =
    build.levels[levelIndex]?.skillRanks?.[skillKey] ?? 0;
  return Math.max(
    0,
    build.levels.length -
      (totalSkillRanks(build, skillKey) - currentLevelRanks),
  );
}

function skillBudgetSummary(
  build: CharacterBuild,
  classOptions: Array<{
    name: string;
    hitDie: number;
    skillRanksPerLevel: number;
  }>,
  levelIndex: number,
) {
  const { budget, allocated, unallocated } = skillBudgetForLevel(
    build,
    classOptions,
    levelIndex,
  );
  const prefix = `Allocated ${allocated}/${budget}`;
  return unallocated >= 0
    ? `${prefix} · ${unallocated} unallocated`
    : `${prefix} · ${Math.abs(unallocated)} over`;
}

function SearchableFeatChip({ featName }: { featName: string }) {
  return (
    <Tooltip content={featTitle(featName)}>
      <span className="chip feature">Bonus feat: {featName}</span>
    </Tooltip>
  );
}

function EditorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="editor-section-head">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="item-list">{children}</div>
    </>
  );
}
