import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  applyLevelUp,
  levelDown,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type ArchetypeDefinitionLike,
  type LevelUpSelection,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES_BY_CLASS,
  RUNTIME_ARMOR,
  RUNTIME_CLASS_OPTIONS,
  RUNTIME_DOMAINS,
  RUNTIME_MAGIC_ITEMS,
  RUNTIME_MUNDANE_EQUIPMENT,
  RUNTIME_RACE_OPTIONS,
  RUNTIME_SCHOOLS,
  RUNTIME_SPELL_OPTIONS,
} from "./content";
import { useRuntimeState } from "./useRuntimeState";
import { applyWeaponLoadoutsToBuild } from "./weaponLoadouts";
import { Sheet } from "./components/Sheet";
import { CombatLogPanel } from "./components/CombatLogPanel";
import {
  LevelUpModal,
  type LevelUpSpellSeedPlan,
} from "./components/LevelUpModal";
import { BuildEditorTab } from "./components/BuildEditorTab";
import { GearTab } from "./components/GearTab";
import { RuntimeControlsPanel } from "./components/RuntimeControlsPanel";
import { BuildSlotsPanel } from "./components/BuildSlotsPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import type { LevelPlannerSuggestions } from "./buildSuggestions";
import { collectOwnedSpellNames } from "./runtimeInsights";
import { normalizeFeatListLength, plannedFeatSlotsForLevel } from "./featSlots";
import { plannerRollbackCount, type PlannerExpansion } from "./plannerState";
import { runtimeStorageKey } from "./features/characters/characterRepository";
import { runtimeWeaponOptions } from "./app/buildNormalization";
import { useBuildPersistence } from "./app/useBuildPersistence";
import { useSpellbookEditor } from "./app/useSpellbookEditor";
import { useWeaponEditor } from "./app/useWeaponEditor";
import { useEquipmentEditor } from "./app/useEquipmentEditor";
import { useBuildBasicsEditor } from "./app/useBuildBasicsEditor";
import { useInventoryCommerce } from "./app/useInventoryCommerce";
import { useLevelEditor } from "./app/useLevelEditor";
import { useCombatEquipmentRuntime } from "./app/useCombatEquipmentRuntime";
import { useCharacterHealth } from "./app/useCharacterHealth";
import { useDerivedSheet } from "./app/useDerivedSheet";
import {
  EMPTY_PLANNER_SUGGESTIONS,
  useBuildAnalysis,
} from "./app/useBuildAnalysis";

const ABILITY_ORDER: readonly AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];
const SKILL_NAME = new Map<string, string>(
  SKILL_DEFINITIONS.map((d) => [d.key, d.name]),
);
const CLASS_OPTIONS = RUNTIME_CLASS_OPTIONS;
const RACE_OPTIONS = RUNTIME_RACE_OPTIONS;
const MAGIC_ITEM_OPTIONS = RUNTIME_MAGIC_ITEMS;
const ARMOR_OPTIONS = RUNTIME_ARMOR;
const MUNDANE_EQUIPMENT_OPTIONS = RUNTIME_MUNDANE_EQUIPMENT;
const RUNTIME_STORAGE_KEY = "mathfinder:web-runtime:v1";
const SPELL_OPTIONS = RUNTIME_SPELL_OPTIONS;
const DOMAIN_OPTIONS = RUNTIME_DOMAINS.filter(
  (domain): domain is (typeof RUNTIME_DOMAINS)[number] =>
    !!domain &&
    typeof domain.name === "string" &&
    domain.name.trim().length > 0,
)
  .map((domain) => ({ id: domain.id, name: domain.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
const SCHOOL_OPTIONS = RUNTIME_SCHOOLS.filter(
  (school): school is (typeof RUNTIME_SCHOOLS)[number] =>
    !!school &&
    typeof school.name === "string" &&
    school.name.trim().length > 0,
)
  .map((school) => ({ id: school.id, name: school.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

type WorkspaceTab = "sheet" | "gear" | "build";

interface AppProps {
  characterId?: string;
  initialTab?: WorkspaceTab;
  onHome?: () => void;
  onTabChange?: (tab: WorkspaceTab) => void;
}

export function App({
  characterId,
  initialTab = "sheet",
  onHome,
  onTabChange,
}: AppProps = {}) {
  const {
    build,
    setBuild,
    currentLevel,
    setCurrentLevel,
    savedBuildSlots,
    deleteBuildSlot,
    overwriteBuildSlot,
    resetPersistedBuild,
    restoreBuildSlot,
    saveNewBuildSlot,
  } = useBuildPersistence(characterId);
  const deferredBuild = useDeferredValue(build);
  const plannerExpansion = useRef<PlannerExpansion | null>(null);
  const {
    addSpellLibraryEntry,
    addSpellSelection,
    adjustSpellExtraSlots,
    appendSpellLibraryEntry,
    appendSpellSelection,
    fillSelectionsFromLibrary,
    removeSpellLibraryEntry,
    removeSpellSelection,
    resetSpellLibraryForClass,
    resetSpellLibraryLevel,
    resetSpellSelectionsForClass,
    resetSpellSelectionsForLevel,
    updateSpellDomains,
    updateSpellLibraryName,
    updateSpellSelectionName,
    updateSpellSpecialization,
  } = useSpellbookEditor(build, setBuild);
  const {
    toggleRaceAlternateTrait,
    updateBaseAbilityScore,
    updateClassArchetypes,
    updateFavoredClassName,
    updateFirearmRulesMode,
    updateRace,
    updateRaceBonusFeat,
    updateRaceFlexibleAbility,
  } = useBuildBasicsEditor(setBuild);
  const {
    buyEquipment,
    sellEquipment,
    updateCarriedWeight,
    updateCoinPurse,
    updateCoinWeightCountsTowardEncumbrance,
  } = useInventoryCommerce(setBuild);
  const {
    addStructureLevel,
    buildWithLevelCount,
    ensureLevelCount,
    setLevelFeat,
    updateLevelField,
    updateLevelSkillRank,
  } = useLevelEditor(build, setBuild);
  const runtime = useRuntimeState(
    characterId ? runtimeStorageKey(characterId) : RUNTIME_STORAGE_KEY,
  );
  const {
    activeBuffs,
    resourcesUsed,
    spellSlotUsage,
    spellCastCounts,
    weaponAttackHistory,
    combatEventLog,
    fatigued,
    resetAll: resetRuntimeState,
    setToggle,
    setExclusiveToggleGroup,
    setFlag,
    adjustResource,
    resetResource,
    adjustSpellSlot,
    resetSpellClassRuntime,
    resetSpellSlotLevel,
    clearCombatEventLog,
    setWeaponAttackOutcome,
    tagLatestWeaponAttackOutcome,
    setWeaponAttackNote,
    setLatestWeaponAttackNote,
    resetWeaponAttackHistory,
  } = runtime;
  const [leveling, setLeveling] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [mountedTabs, setMountedTabs] = useState({
    sheet: initialTab === "sheet",
    gear: initialTab === "gear",
    build: initialTab === "build",
  });
  const weaponOptions = useMemo(
    () => runtimeWeaponOptions(build.campaignRules),
    [build.campaignRules],
  );
  const { addWeapon, applyWeaponTemplate, removeWeapon, updateWeapon } =
    useWeaponEditor(setBuild, weaponOptions);
  const {
    addArmorFromTemplate,
    addEquipment,
    addEquipmentFromTemplate,
    addMagicItem,
    addMagicItemFromTemplate,
    addShieldFromTemplate,
    applyArmorTemplate,
    applyEquipmentWeaponTemplate,
    applyMagicItemTemplate,
    applyMundaneEquipmentTemplate,
    applyShieldTemplate,
    removeEquipment,
    stepMagicItemTier,
    updateEquipment,
    updateEquipmentArmor,
    updateEquipmentShield,
    updateEquipmentWeapon,
  } = useEquipmentEditor(build, setBuild, weaponOptions);

  function clampCurrentLevel(level: number, levelCount = build.levels.length) {
    return Math.max(1, Math.min(levelCount, level));
  }

  function selectTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    onTabChange?.(tab);
  }

  function confirmLevelUp(
    selection: LevelUpSelection,
    spellSeedPlans: LevelUpSpellSeedPlan[],
  ) {
    setBuild((b) => {
      const next = applyLevelUp(b, selection);
      let seeded = next;
      for (const plan of spellSeedPlans) {
        const library =
          seeded.spellLibrary?.[plan.classKey]?.[plan.level] ?? [];
        const nextLibrary = [...library];
        for (const spellName of plan.spells)
          if (!nextLibrary.includes(spellName)) nextLibrary.push(spellName);
        seeded = {
          ...seeded,
          spellLibrary: {
            ...(seeded.spellLibrary ?? {}),
            [plan.classKey]: {
              ...((seeded.spellLibrary ?? {})[plan.classKey] ?? {}),
              [plan.level]: nextLibrary,
            },
          },
          spellSelections: {
            ...(seeded.spellSelections ?? {}),
            [plan.classKey]: {
              ...((seeded.spellSelections ?? {})[plan.classKey] ?? {}),
              [plan.mode]: {
                ...((seeded.spellSelections ?? {})[plan.classKey]?.[
                  plan.mode
                ] ?? {}),
                [plan.level]: plan.spells,
              },
            },
          },
        };
      }
      return seeded;
    });
    setCurrentLevel((prev) =>
      clampCurrentLevel(prev + 1, build.levels.length + 1),
    );
    selectTab("build");
    setLeveling(false);
  }

  function advanceLevel() {
    if (currentLevel < build.levels.length) {
      setCurrentLevel((prev) => clampCurrentLevel(prev + 1));
      return;
    }
    setLeveling(true);
  }

  function undoCurrentLevel() {
    if (currentLevel < build.levels.length) {
      setCurrentLevel((prev) => clampCurrentLevel(prev - 1));
      return;
    }
    if (build.levels.length <= 1) return;
    setBuild((b) => levelDown(b));
    setCurrentLevel((prev) =>
      clampCurrentLevel(prev - 1, build.levels.length - 1),
    );
  }

  function loadBuildSlotById(slotId: string) {
    if (!restoreBuildSlot(slotId)) return;
    resetRuntimeState();
    setLeveling(false);
  }

  function resetCurrentBuild() {
    resetPersistedBuild();
    resetRuntimeState();
    setLeveling(false);
  }

  function clearPlannedLevelChoices(levelIndex: number) {
    const isFutureLevel = levelIndex >= currentLevel;
    if (isFutureLevel) {
      const expansion = plannerExpansion.current;
      const rollbackCount = plannerRollbackCount(
        currentLevel,
        levelIndex,
        expansion,
      );
      plannerExpansion.current = null;
      setBuild((prev) => ({
        ...prev,
        levels: prev.levels.slice(0, rollbackCount),
      }));
      setGuidedPlannerSuggestions((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([index]) => Number(index) < rollbackCount,
          ),
        ),
      );
      return;
    }

    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.map((level, i) =>
        i === levelIndex
          ? {
              ...level,
              feats: undefined,
              favoredClass: undefined,
              abilityIncrease: undefined,
              skillRanks: {},
              modifiers: [],
            }
          : level,
      ),
    }));
    setGuidedPlannerSuggestions((prev) => {
      const next = { ...prev };
      delete next[levelIndex];
      return next;
    });
  }

  function applyPlannerSuggestions(
    levelIndex: number,
    suggestions: LevelPlannerSuggestions,
  ) {
    setBuild((prev) => {
      const currentLevel = prev.levels[levelIndex];
      if (!currentLevel) return prev;
      const nextLevels = [...prev.levels];
      const nextClassName =
        suggestions.classChoices[0]?.value ?? currentLevel.className;
      const nextFavoredClass = suggestions.favoredClassChoices[0]?.value;
      const nextAbilityIncrease =
        suggestions.abilityChoices[0]?.value ?? currentLevel.abilityIncrease;
      nextLevels[levelIndex] = {
        ...currentLevel,
        className: nextClassName,
        favoredClass:
          nextFavoredClass === "none"
            ? undefined
            : (nextFavoredClass ?? currentLevel.favoredClass),
        abilityIncrease: nextAbilityIncrease,
      };
      const previewBuild = { ...prev, levels: nextLevels };
      const slotCount = plannedFeatSlotsForLevel(
        previewBuild,
        levelIndex,
      ).length;
      const existingFeats =
        normalizeFeatListLength(nextLevels[levelIndex]?.feats, slotCount) ??
        Array.from({ length: slotCount }, () => "");
      suggestions.featChoicesBySlot.forEach((slotSuggestion) => {
        if (
          slotSuggestion.slotIndex < slotCount &&
          slotSuggestion.choices[0]?.value
        ) {
          existingFeats[slotSuggestion.slotIndex] =
            slotSuggestion.choices[0].value;
        }
      });
      nextLevels[levelIndex] = {
        ...nextLevels[levelIndex],
        feats:
          slotCount > 0
            ? normalizeFeatListLength(existingFeats, slotCount)
            : undefined,
      };
      return { ...prev, levels: nextLevels };
    });
  }

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setMountedTabs((prev) =>
      prev[activeTab] ? prev : { ...prev, [activeTab]: true },
    );
  }, [activeTab]);

  const effectiveBuild = useMemo(
    () =>
      applyWeaponLoadoutsToBuild({
        ...deferredBuild,
        levels: deferredBuild.levels.slice(0, currentLevel),
      }),
    [currentLevel, deferredBuild],
  );

  const {
    sheet,
    activatableGroups,
    activatableConflicts,
    resourceMaxes,
    resourceLabels,
    runtimeBuffs,
    spellEffectContext,
  } = useDerivedSheet({
    build: effectiveBuild,
    activeBuffs,
    fatigued,
    spellSlotUsage,
  });
  const {
    castSpell,
    recordWeaponAttack,
    resetAmmo,
    setSheetWeaponLoadedAmmo,
    undoWeaponAttack,
  } = useCombatEquipmentRuntime(build, setBuild, spellEffectContext, runtime);

  const shouldComputeSuggestions = activeTab === "build" || leveling;
  const {
    computeGuidedSuggestionBundle,
    errors,
    featOptions,
    plannerSuggestions,
    setGuidedPlannerSuggestions,
    suggestionBundle,
    wealthSummary,
    runtimeProfile,
  } = useBuildAnalysis({
    deferredBuild,
    effectiveBuild,
    currentLevel,
    sheet,
    shouldComputeSuggestions,
  });
  const ownedSpellNames = useMemo(
    () => collectOwnedSpellNames(sheet.spellcasting),
    [sheet.spellcasting],
  );
  const {
    applyDirectHpLoss,
    applyHealing,
    applyIncomingDamage,
    applyNonlethalDamage,
    currentHp,
    deathRules,
    diehardActive,
    ferocityUsed,
    fightOnSource,
    healNonlethal,
    hpDamageTaken,
    nonlethalDamage,
    resetHp,
    setDiehardActive,
    setFerocityActive,
    setFerocityUsed,
    setStable,
    setTempHp,
    stable,
    tempHp,
  } = useCharacterHealth(effectiveBuild, sheet, resourceMaxes, runtime);

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          Mathfinder{" "}
          <span className="brand-sub">Pathfinder 1e smart sheet</span>
        </div>
        <div className="actions">
          {onHome ? (
            <button className="ghost" onClick={onHome}>
              ← Home
            </button>
          ) : null}
          <button onClick={advanceLevel}>⬆ Level Up</button>
          <button
            className="ghost"
            disabled={currentLevel <= 1}
            onClick={undoCurrentLevel}
          >
            ↩ Undo Level
          </button>
        </div>
      </header>

      <div className="tab-bar">
        <button
          className={activeTab === "sheet" ? "tab-button active" : "tab-button"}
          onClick={() => selectTab("sheet")}
        >
          Sheet
        </button>
        <button
          className={activeTab === "gear" ? "tab-button active" : "tab-button"}
          onClick={() => selectTab("gear")}
        >
          Gear
        </button>
        <button
          className={activeTab === "build" ? "tab-button active" : "tab-button"}
          onClick={() => selectTab("build")}
        >
          Build
        </button>
      </div>

      <div hidden={activeTab !== "sheet"}>
        <div className="layout sheet-layout">
          <aside className="controls sheet-sidebar">
            <RuntimeControlsPanel
              activatableGroups={activatableGroups}
              activatableConflicts={activatableConflicts}
              activeBuffs={activeBuffs}
              resourcesUsed={resourcesUsed}
              resourceMaxes={resourceMaxes}
              resourceLabels={resourceLabels}
              fatigued={fatigued}
              buffs={runtimeBuffs}
              ownedSpellNames={ownedSpellNames}
              profile={runtimeProfile}
              onSetToggle={setToggle}
              onSetExclusiveToggleGroup={setExclusiveToggleGroup}
              onSetFlag={setFlag}
              onAdjustResource={adjustResource}
              onResetResource={resetResource}
            />

            {!characterId ? (
              <BuildSlotsPanel
                savedBuildSlots={savedBuildSlots}
                onSaveNewBuildSlot={saveNewBuildSlot}
                onResetCurrentBuild={resetCurrentBuild}
                onLoadBuildSlot={loadBuildSlotById}
                onOverwriteBuildSlot={overwriteBuildSlot}
                onDeleteBuildSlot={deleteBuildSlot}
              />
            ) : null}

            <ValidationPanel errors={errors} />
          </aside>

          <main className="main sheet-main">
            <div className="sheet-main-stack">
              <Sheet
                sheet={sheet}
                wealthSummary={wealthSummary}
                currentHp={currentHp}
                hpDamageTaken={hpDamageTaken}
                tempHp={tempHp}
                nonlethalDamage={nonlethalDamage}
                stable={stable}
                deathRules={deathRules}
                fightOnSource={fightOnSource}
                diehardActive={diehardActive}
                ferocityUsed={ferocityUsed}
                onApplyDamage={applyIncomingDamage}
                onApplyHealing={applyHealing}
                onApplyHpLoss={applyDirectHpLoss}
                onSetTempHp={setTempHp}
                onApplyNonlethal={applyNonlethalDamage}
                onHealNonlethal={healNonlethal}
                onSetStable={setStable}
                onSetDiehardActive={setDiehardActive}
                onSetFerocityActive={setFerocityActive}
                onSetFerocityUsed={setFerocityUsed}
                onResetHp={resetHp}
                spellCastCounts={spellCastCounts}
                onCastSpell={castSpell}
                onResetSpellSlotLevel={resetSpellSlotLevel}
                weaponAttackHistory={weaponAttackHistory}
                onWeaponAttack={recordWeaponAttack}
                onSetWeaponLoadedAmmo={setSheetWeaponLoadedAmmo}
                onUndoWeaponAttack={undoWeaponAttack}
                onTagWeaponAttackOutcome={tagLatestWeaponAttackOutcome}
                onSetWeaponAttackOutcome={setWeaponAttackOutcome}
                onSetWeaponAttackNote={setLatestWeaponAttackNote}
                onSetSpecificWeaponAttackNote={setWeaponAttackNote}
                onResetWeaponAttackHistory={resetWeaponAttackHistory}
                onResetAmmo={resetAmmo}
              />
              <CombatLogPanel
                combatEventLog={combatEventLog}
                onClearCombatEventLog={clearCombatEventLog}
              />
            </div>
          </main>
        </div>
      </div>

      {mountedTabs.gear ? (
        <div hidden={activeTab !== "gear"}>
          <GearTab
            build={build}
            onUpdateCarriedWeight={updateCarriedWeight}
            onUpdateCoinPurse={updateCoinPurse}
            onUpdateCoinWeightCountsTowardEncumbrance={
              updateCoinWeightCountsTowardEncumbrance
            }
            onBuyEquipment={buyEquipment}
            onSellEquipment={sellEquipment}
            weaponOptions={weaponOptions}
            magicItemOptions={MAGIC_ITEM_OPTIONS}
            mundaneEquipmentOptions={MUNDANE_EQUIPMENT_OPTIONS}
            armorOptions={ARMOR_OPTIONS}
            onAddWeapon={addWeapon}
            onUpdateWeapon={updateWeapon}
            onApplyWeaponTemplate={applyWeaponTemplate}
            onRemoveWeapon={removeWeapon}
            onAddEquipment={addEquipment}
            onAddEquipmentFromTemplate={addEquipmentFromTemplate}
            onAddArmorFromTemplate={addArmorFromTemplate}
            onAddShieldFromTemplate={addShieldFromTemplate}
            onAddMagicItem={addMagicItem}
            onAddMagicItemFromTemplate={addMagicItemFromTemplate}
            onUpdateEquipment={updateEquipment}
            onUpdateEquipmentArmor={updateEquipmentArmor}
            onUpdateEquipmentShield={updateEquipmentShield}
            onUpdateEquipmentWeapon={updateEquipmentWeapon}
            onApplyEquipmentWeaponTemplate={applyEquipmentWeaponTemplate}
            onApplyMagicItemTemplate={applyMagicItemTemplate}
            onApplyMundaneEquipmentTemplate={applyMundaneEquipmentTemplate}
            onApplyArmorTemplate={applyArmorTemplate}
            onApplyShieldTemplate={applyShieldTemplate}
            onStepMagicItemTier={stepMagicItemTier}
            onRemoveEquipment={removeEquipment}
          />
        </div>
      ) : null}

      {mountedTabs.build ? (
        <div hidden={activeTab !== "build"}>
          <BuildEditorTab
            build={build}
            currentLevel={currentLevel}
            sheetSpellcasting={sheet.spellcasting}
            abilityOrder={ABILITY_ORDER}
            raceOptions={RACE_OPTIONS}
            classOptions={CLASS_OPTIONS}
            archetypeOptionsByClass={
              RUNTIME_ARCHETYPES_BY_CLASS as Record<
                string,
                ArchetypeDefinitionLike[]
              >
            }
            featOptions={featOptions}
            plannerSuggestions={plannerSuggestions}
            currentLevelSkillSuggestions={suggestionBundle.currentLevelSkills}
            currentLevelSkillNotes={suggestionBundle.currentLevelSkillNotes}
            spellSuggestions={suggestionBundle.spellChoices}
            skillName={SKILL_NAME}
            spellOptions={SPELL_OPTIONS}
            domainOptions={DOMAIN_OPTIONS}
            schoolOptions={SCHOOL_OPTIONS}
            spellCastCounts={spellCastCounts}
            onUpdateName={(name) => setBuild((prev) => ({ ...prev, name }))}
            onUpdateBaseAbilityScore={updateBaseAbilityScore}
            onUpdateRace={updateRace}
            onUpdateRaceFlexibleAbility={updateRaceFlexibleAbility}
            onUpdateRaceBonusFeat={updateRaceBonusFeat}
            onToggleRaceAlternateTrait={toggleRaceAlternateTrait}
            onUpdateFavoredClassName={updateFavoredClassName}
            onUpdateFirearmRulesMode={updateFirearmRulesMode}
            onUpdateClassArchetypes={updateClassArchetypes}
            onAddStructureLevel={addStructureLevel}
            onEnsureLevelCount={(count) => {
              const nextBuild = buildWithLevelCount(build, count);
              if (count > build.levels.length) {
                plannerExpansion.current = {
                  previousCount: build.levels.length,
                  targetCount: Math.min(20, count),
                };
              }
              ensureLevelCount(count);
              const requestedLevels = Array.from(
                { length: Math.max(0, count - build.levels.length) },
                (_, offset) => build.levels.length + offset,
              );
              const guided = computeGuidedSuggestionBundle(
                nextBuild,
                requestedLevels,
              ).planner;
              setGuidedPlannerSuggestions(
                Object.fromEntries(
                  guided
                    .map((suggestions, index) => [index, suggestions] as const)
                    .filter(
                      ([, suggestions]) => suggestions.guideChoices.length > 0,
                    ),
                ),
              );
            }}
            onSetCurrentLevel={(level) =>
              setCurrentLevel(clampCurrentLevel(level))
            }
            onUpdateLevelField={updateLevelField}
            onUpdateLevelSkillRank={updateLevelSkillRank}
            onSetLevelFeat={setLevelFeat}
            onApplyPlannerSuggestions={(levelIndex) => {
              const guidedBundle = computeGuidedSuggestionBundle(build, [
                levelIndex,
              ]);
              const suggestions = guidedBundle.planner[levelIndex];
              if (!suggestions) return;
              setGuidedPlannerSuggestions((prev) => ({
                ...prev,
                [levelIndex]: suggestions,
              }));
              applyPlannerSuggestions(levelIndex, suggestions);
            }}
            onRequestPlannerSuggestions={(levelIndex) => {
              const suggestions = computeGuidedSuggestionBundle(build, [
                levelIndex,
              ]).planner[levelIndex];
              if (!suggestions) return;
              setGuidedPlannerSuggestions((prev) => ({
                ...prev,
                [levelIndex]: suggestions,
              }));
            }}
            onClearPlannedLevelChoices={clearPlannedLevelChoices}
            onAddSelection={addSpellSelection}
            onAppendSelection={appendSpellSelection}
            onUpdateSelectionName={updateSpellSelectionName}
            onRemoveSelection={removeSpellSelection}
            onResetSelectionsForLevel={resetSpellSelectionsForLevel}
            onResetSelectionsForClass={resetSpellSelectionsForClass}
            onAddLibraryEntry={addSpellLibraryEntry}
            onAppendLibraryEntry={appendSpellLibraryEntry}
            onUpdateLibraryName={updateSpellLibraryName}
            onRemoveLibraryEntry={removeSpellLibraryEntry}
            onResetLibraryLevel={resetSpellLibraryLevel}
            onResetLibraryForClass={resetSpellLibraryForClass}
            onFillSelectionsFromLibrary={fillSelectionsFromLibrary}
            onUpdateDomains={updateSpellDomains}
            onUpdateSpecialization={updateSpellSpecialization}
            onAdjustExtraSpellSlots={adjustSpellExtraSlots}
            onAdjustSpellSlot={adjustSpellSlot}
            onCastSpell={castSpell}
            onResetSpellSlotLevel={resetSpellSlotLevel}
            onResetSpellRuntimeClass={resetSpellClassRuntime}
          />
        </div>
      ) : null}

      {leveling ? (
        <LevelUpModal
          build={effectiveBuild}
          plannerSuggestions={
            suggestionBundle.planner[
              Math.max(0, effectiveBuild.levels.length)
            ] ?? EMPTY_PLANNER_SUGGESTIONS
          }
          skillSuggestions={suggestionBundle.currentLevelSkills}
          skillSuggestionNotes={suggestionBundle.currentLevelSkillNotes}
          onConfirm={confirmLevelUp}
          onClose={() => setLeveling(false)}
        />
      ) : null}
    </div>
  );
}
