import {
  ALIGNMENT_LABELS,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type Alignment,
  type ArchetypeDefinitionLike,
  type CharacterBuild,
  type DerivedSpellcasting,
  type FirearmRulesMode,
  type SkillKey,
} from "@mathfinder/rules-engine";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RUNTIME_FEATS, RUNTIME_WEAPONS } from "../content";
import { collectFeatWeaponNames } from "../featOptionData";
import { featTitle } from "../rulesText";
import type { SpellCastCounts } from "../runtimeState";
import { skillMetadataTooltip, skillTrainingFlag } from "../skillPresentation";
import {
  effectiveRaceChoiceOptions,
  totalAllocatedSkillRanks,
  totalSkillRankBudget,
  totalSkillRanks,
} from "../skillRankProgression";
import { LevelProgressionPlanner } from "./LevelProgressionPlanner";
import type {
  LevelPlannerSuggestions,
  SkillSuggestionChoice,
  SpellSuggestionChoice,
} from "../buildSuggestions";
import { AlignmentPicker } from "./AlignmentPicker";
import { ArchetypePicker } from "./ArchetypePicker";
import type { CompendiumOption } from "./CompendiumPicker";
import { FeatSelectionPicker } from "./FeatSelectionPicker";
import { SpellcastingManager } from "./SpellcastingManager";
import { Tooltip } from "./Tooltip";

type SpellMode = "prepared" | "known";

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
    classSkills: SkillKey[];
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
  onUpdateAlignment: (alignment: Alignment) => void;
  onUpdateBaseAbilityScore: (ability: AbilityKey, value: number) => void;
  onUpdateRace: (raceKey: string) => void;
  onUpdateRaceFlexibleAbility: (ability: AbilityKey) => void;
  onUpdateRaceBonusFeat: (featName: string) => void;
  onToggleRaceAlternateTrait: (traitId: string) => void;
  onUpdateFavoredClassName: (value: string) => void;
  onUpdateFirearmRulesMode: (value: FirearmRulesMode) => void;
  onUpdateClassArchetypes: (className: string, archetypeIds: string[]) => void;
  onUpdateInfantrymanGunTraining: (weaponName: string) => void;
  onUpdateIgnoreAlignmentRestrictions: (value: boolean) => void;
  onUpdateIgnoreEncumbrance: (value: boolean) => void;
  onAddStructureLevel: () => void;
  onEnsureLevelCount: (count: number) => void;
  onSetCurrentLevel: (level: number) => void;
  onUpdateLevelField: <K extends keyof CharacterBuild["levels"][number]>(
    levelIndex: number,
    key: K,
    value: CharacterBuild["levels"][number][K],
  ) => void;
  onUpdateTotalSkillRank: (skillKey: SkillKey, value: number) => void;
  onSetLevelFeat: (
    levelIndex: number,
    featIndex: number,
    value: string,
  ) => void;
  onApplyPlannerSuggestions: (levelIndex: number) => void;
  onRequestPlannerSuggestions: (levelIndex: number) => void;
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
  const [coreSetupOpen, setCoreSetupOpen] = useState(true);
  const [coreSetupAutoCollapsed, setCoreSetupAutoCollapsed] = useState(false);
  const currentLevelIndex = Math.max(0, currentLevel - 1);
  const currentLevelEntry = build.levels[currentLevelIndex];
  const characterClassSkills = new Set(
    build.levels.flatMap(
      (level) =>
        classOptions.find((option) => option.name === level.className)
          ?.classSkills ?? [],
    ),
  );
  const totalSkillBudget = totalSkillRankBudget(build, classOptions);
  const allocatedSkillTotal = totalAllocatedSkillRanks(build);
  const raceChoiceOptions = effectiveRaceChoiceOptions(build.race);
  const raceBonusFeatOptions = useMemo(() => {
    const allowed = raceChoiceOptions.bonusFeat?.featOptions;
    if (!allowed?.length) return featOptions;
    const allowedSet = new Set(allowed.map((feat) => feat.toLowerCase()));
    return featOptions.filter((option) =>
      allowedSet.has(option.name.toLowerCase()),
    );
  }, [featOptions, raceChoiceOptions.bonusFeat?.featOptions]);
  const availableFeatWeaponNames = useMemo(
    () => collectFeatWeaponNames(build, RUNTIME_WEAPONS),
    [build],
  );
  const archetypeClasses = useMemo(
    () =>
      [...new Set(build.levels.map((level) => level.className))]
        .sort((a, b) => a.localeCompare(b))
        .map((className) => ({
          className,
          classKey: className.toLowerCase(),
          archetypes: archetypeOptionsByClass[className.toLowerCase()] ?? [],
        }))
        .filter(({ archetypes }) => archetypes.length > 0),
    [archetypeOptionsByClass, build.levels],
  );
  const coreSetupLooksConfigured =
    abilityOrder.some((ability) => build.baseAbilityScores[ability] !== 10) ||
    !!build.alignment ||
    build.race.name.trim().toLowerCase() !== "human" ||
    (build.levels[0]?.className.trim().toLowerCase() ?? "") !== "fighter" ||
    !!build.favoredClassName ||
    !!build.race.choiceSelection?.flexibleAbility ||
    !!build.race.choiceSelection?.bonusFeat ||
    (build.race.choiceSelection?.alternateTraits?.length ?? 0) > 0;
  const coreSetupSummary = [
    build.race.name,
    build.alignment ? ALIGNMENT_LABELS[build.alignment] : "Alignment unset",
    `L1 ${build.levels[0]?.className ?? "Fighter"}`,
    build.favoredClassName ? `Favored ${build.favoredClassName}` : null,
    abilityOrder
      .map(
        (ability) =>
          `${ability.toUpperCase()} ${build.baseAbilityScores[ability]}`,
      )
      .join(" · "),
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (coreSetupLooksConfigured && !coreSetupAutoCollapsed) {
      setCoreSetupOpen(false);
      setCoreSetupAutoCollapsed(true);
    }
  }, [coreSetupAutoCollapsed, coreSetupLooksConfigured]);

  return (
    <div className="build-page">
      <section className="panel build-panel">
        <h2>Build Editor</h2>
        <p className="hint">
          This is the crunchy tab. Character construction lives here now; all
          the inventory hoarding got kicked to Gear. The progression planner
          below already bakes in guide suggestions, so we’re not doing the same
          dance twice.
        </p>

        <div className="item-card build-core-setup">
          <div className="editor-section-head tight">
            <div>
              <h3>Core Build Setup</h3>
              {!coreSetupOpen ? (
                <div className="build-core-setup-summary">
                  {coreSetupSummary}
                </div>
              ) : null}
            </div>
            <button
              className="ghost small"
              type="button"
              onClick={() => setCoreSetupOpen((open) => !open)}
            >
              {coreSetupOpen ? "Collapse" : "Expand"}
            </button>
          </div>

          {coreSetupOpen ? (
            <>
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

              <div className="field compact alignment-field">
                <span>Alignment</span>
                <AlignmentPicker
                  value={build.alignment}
                  onChange={props.onUpdateAlignment}
                />
              </div>

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
                <button
                  className="ghost small"
                  onClick={props.onAddStructureLevel}
                >
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
                    onChange={(e) =>
                      props.onUpdateFavoredClassName(e.target.value)
                    }
                  >
                    <option value="">None</option>
                    {classOptions.map((option) => (
                      <option
                        key={`favored-${option.name}`}
                        value={option.name}
                      >
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
                    <option value="commonplace-guns">Commonplace Guns</option>
                    <option value="guns-everywhere">Guns Everywhere</option>
                  </select>
                </label>
                <label className="pick campaign-rule-pick">
                  <input
                    type="checkbox"
                    checked={
                      build.campaignRules?.ignoreAlignmentRestrictions === true
                    }
                    onChange={(event) =>
                      props.onUpdateIgnoreAlignmentRestrictions(
                        event.target.checked,
                      )
                    }
                  />
                  <span>
                    <strong>Ignore alignment restrictions</strong>
                    <span className="buff-desc">
                      House rule: classes do not enforce alignment requirements.
                    </span>
                  </span>
                </label>
                <label className="pick campaign-rule-pick">
                  <input
                    type="checkbox"
                    checked={build.campaignRules?.ignoreEncumbrance === true}
                    onChange={(event) =>
                      props.onUpdateIgnoreEncumbrance(event.target.checked)
                    }
                  />
                  <span>
                    <strong>Ignore encumbrance</strong>
                    <span className="buff-desc">
                      House rule: keep carried weight visible but ignore
                      load-based penalties and restrictions.
                    </span>
                  </span>
                </label>
              </div>
              {Object.keys(raceChoiceOptions).length > 0 ||
              build.race.alternateTraits?.length ? (
                <div className="item-card nested">
                  <div className="editor-section-head tight">
                    <h3>Race Choices</h3>
                    <span className="skill-builder-meta">
                      {build.race.name}
                    </span>
                  </div>
                  <div className="editor-grid">
                    {raceChoiceOptions.flexibleAbilityBonus ? (
                      <label className="field compact">
                        <span>
                          Flexible +
                          {raceChoiceOptions.flexibleAbilityBonus.value}
                        </span>
                        <select
                          value={
                            build.race.choiceSelection?.flexibleAbility ?? ""
                          }
                          onChange={(e) =>
                            props.onUpdateRaceFlexibleAbility(
                              e.target.value as AbilityKey,
                            )
                          }
                        >
                          {(
                            raceChoiceOptions.flexibleAbilityBonus
                              .abilities ?? [...abilityOrder]
                          ).map((ability) => (
                            <option
                              key={`race-flex-${ability}`}
                              value={ability}
                            >
                              {ability.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {raceChoiceOptions.bonusFeat ? (
                      <label className="field compact">
                        <span>Bonus feat</span>
                        <FeatSelectionPicker
                          value={build.race.choiceSelection?.bonusFeat ?? ""}
                          onChange={props.onUpdateRaceBonusFeat}
                          featRegistry={RUNTIME_FEATS}
                          grantKind="general"
                          availableWeaponNames={availableFeatWeaponNames}
                          allowedOptions={raceBonusFeatOptions}
                          placeholder="Search feat"
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
                        ).some(
                          (id) => id.toLowerCase() === trait.id.toLowerCase(),
                        );
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
            </>
          ) : null}
        </div>

        {archetypeClasses.length > 0 ? (
          <EditorSection title="Class Archetypes">
            <div className="race-alt-trait-list">
              {archetypeClasses.map(({ className, classKey, archetypes }) => (
                <div
                  key={`archetypes-${classKey}`}
                  className="item-card nested"
                >
                  <ArchetypePicker
                    className={className}
                    archetypes={archetypes}
                    selectedIds={build.classArchetypes?.[classKey] ?? []}
                    onSelectionChange={(ids) =>
                      props.onUpdateClassArchetypes(className, ids)
                    }
                  />
                </div>
              ))}
            </div>
          </EditorSection>
        ) : null}

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
              onRequestPlannerSuggestions={props.onRequestPlannerSuggestions}
              onClearPlannedLevelChoices={props.onClearPlannedLevelChoices}
              onUpdateInfantrymanGunTraining={
                props.onUpdateInfantrymanGunTraining
              }
            />
          ) : null}
        </section>

        <EditorSection title="Character Skill Ranks">
          {currentLevelEntry ? (
            <div className="item-card">
              <div className="editor-section-head tight">
                <h3>Total ranks across {build.levels.length} levels</h3>
                <span className="skill-builder-meta">
                  Allocated {allocatedSkillTotal}/{totalSkillBudget} ·{" "}
                  {Math.max(0, totalSkillBudget - allocatedSkillTotal)}{" "}
                  unallocated
                </span>
              </div>
              {currentLevelSkillSuggestions.length > 0 ? (
                <>
                  <div className="planner-suggestions">
                    {currentLevelSkillSuggestions.map((suggestion) => {
                      const currentRanks = totalSkillRanks(
                        build,
                        suggestion.key,
                      );
                      const unallocated =
                        totalSkillBudget - allocatedSkillTotal;
                      const canApply =
                        unallocated > 0 && currentRanks < build.levels.length;
                      return (
                        <button
                          key={`skill-suggestion-${suggestion.key}`}
                          type="button"
                          className="ghost tiny planner-suggestion-chip"
                          title={suggestion.reason}
                          disabled={!canApply}
                          onClick={() =>
                            props.onUpdateTotalSkillRank(
                              suggestion.key,
                              currentRanks + 1,
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
                    const ranks = totalSkillRanks(build, skill.key);
                    const isClassSkill = characterClassSkills.has(skill.key);
                    const usable = !skill.trainedOnly || ranks > 0;
                    const metadata = skillMetadataTooltip({
                      ability: skill.ability,
                      isClassSkill,
                      trainedOnly: skill.trainedOnly,
                      usable,
                      armorCheckPenalty: skill.armorCheckPenalty,
                      className: "this build",
                    });
                    return (
                      <div
                        className="skill-rank-row skill-rank-table-row"
                        key={`rank-${currentLevelIndex}-${skill.key}`}
                      >
                        <Tooltip
                          content={metadata}
                          className="skill-rank-label-tooltip"
                        >
                          <span className="skill-rank-label skill-metadata-anchor">
                            {skillName.get(skill.key) ?? skill.key}
                          </span>
                        </Tooltip>
                        <span className="skill-rank-meta">
                          {skill.ability.toUpperCase()}
                        </span>
                        <Tooltip content={metadata}>
                          <span className="skill-flags skill-rank-flags">
                            <span
                              className={`skill-flag ${isClassSkill ? "" : "muted"}`}
                            >
                              {isClassSkill ? "C" : "—"}
                            </span>
                            <span
                              className={`skill-flag ${usable ? (skill.trainedOnly ? "" : "muted") : "warn"}`}
                            >
                              {skillTrainingFlag(skill.trainedOnly, usable)}
                            </span>
                            {skill.armorCheckPenalty ? (
                              <span className="skill-flag">A</span>
                            ) : null}
                          </span>
                        </Tooltip>
                        <input
                          aria-label={`${skillName.get(skill.key) ?? skill.key} total character ranks`}
                          title={`Total character ranks; maximum ${build.levels.length}`}
                          type="number"
                          min={0}
                          max={build.levels.length}
                          step={1}
                          value={ranks}
                          onChange={(e) =>
                            props.onUpdateTotalSkillRank(
                              skill.key,
                              Number(e.target.value),
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
