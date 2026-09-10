import { HeaderProfile } from "./components/ProfileMenu";
import { SaveSection, SectionSaveProvider } from "./components/SaveSection";
import { useSectionDraft } from "./features/characters/useSectionDraft";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CharacterLanguages } from "./components/CharacterLanguages";
import { BuildSection } from "./components/BuildSection";
import {
  applyLevelUp,
  levelDown,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type ArchetypeDefinitionLike,
  type CharacterBuild,
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
import { restorableAbilityResourceIds } from "./characterReferences";
import { MagicWorkspace as SpellcastingManager } from "./components/MagicWorkspace";
import { BuildSlotsPanel } from "./components/BuildSlotsPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import { HoldToActivateButton } from "./components/HoldToActivateButton";
import type { LevelPlannerSuggestions } from "./buildSuggestions";
import { collectOwnedSpellNames } from "./runtimeInsights";
import { normalizeFeatListLength, plannedFeatSlotsForLevel } from "./featSlots";
import { plannerRollbackCount, type PlannerExpansion } from "./plannerState";
import {
  getCharacter,
  listCharacters,
  runtimeStorageKey,
  saveCharacterDetails,
  type CharacterDetails,
} from "./features/characters/characterRepository";
import { CharacterIdentityBar } from "./features/characters/CharacterIdentityBar";
import { CharacterNotes } from "./features/characters/CharacterNotes";
import { accountStorage, cacheWritable } from "./lib/accountCache";
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

type WorkspaceTab = "notes" | "character" | "inventory" | "magic" | "build";

interface PendingSpellCast {
  classKey: string;
  level: number;
  max: number;
  spellName: string;
  remaining: number;
}

interface AppProps {
  characterId?: string;
  initialTab?: WorkspaceTab;
  onHome?: () => void;
  onTabChange?: (tab: WorkspaceTab) => void;
}

export function App({
  characterId,
  initialTab = "character",
  onHome,
  onTabChange,
}: AppProps = {}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
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
    flushBuildPersistence,
  } = useBuildPersistence(characterId, activeTab === "character");
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
    updateAlignment,
    updateBaseAbilityScore,
    updateClassArchetypes,
    updateFavoredClassName,
    updateFirearmRulesMode,
    updateIgnoreAlignmentRestrictions,
    updateIgnoreEncumbrance,
    updateInfantrymanGunTraining,
    updateRace,
    updateRaceBonusFeat,
    updateRaceFlexibleAbility,
  } = useBuildBasicsEditor(setBuild);
  const {
    buyEquipment,
    sellEquipment,
    adjustCoinPurse,
    updateCoinPurse,
    updateCoinWeightCountsTowardEncumbrance,
  } = useInventoryCommerce(setBuild);
  const {
    addStructureLevel,
    buildWithLevelCount,
    ensureLevelCount,
    setLevelFeat,
    updateLevelField,
    updateTotalSkillRank,
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
  } = runtime;
  const [leveling, setLeveling] = useState(false);
  const [levelUpEffect, setLevelUpEffect] = useState<
    "idle" | "holding" | "charged" | "celebrating"
  >("idle");
  const levelUpEffectTimer = useRef<number | undefined>(undefined);
  const [details, setDetails, flushDetails] = useSectionDraft<CharacterDetails>(
    characterId ?? "local",
    "details-section-draft",
    () =>
      (characterId
        ? getCharacter(accountStorage, characterId)?.details
        : undefined) ?? {},
    (next) => {
      if (!characterId) return true;
      if (!cacheWritable() || !getCharacter(accountStorage, characterId))
        return false;
      saveCharacterDetails(accountStorage, characterId, next);
      return true;
    },
    false,
  );
  const flushSection = () => {
    flushBuildPersistence();
    flushDetails();
  };
  const sectionSaveRef = useRef(flushSection);
  sectionSaveRef.current = flushSection;
  const previousTab = useRef(activeTab);
  useEffect(() => {
    if (previousTab.current !== activeTab) sectionSaveRef.current();
    previousTab.current = activeTab;
  }, [activeTab]);
  const [effectsRailOpen, setEffectsRailOpen] = useState(true);
  const [resting, setResting] = useState(false);
  const [pendingSpellCast, setPendingSpellCast] = useState<PendingSpellCast>();
  const [spellTargetIds, setSpellTargetIds] = useState<string[]>([]);
  const [mountedTabs, setMountedTabs] = useState({
    notes: initialTab === "notes",
    character: initialTab === "character",
    inventory: initialTab === "inventory",
    magic: initialTab === "magic",
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

  function clearLevelUpEffectTimer() {
    if (levelUpEffectTimer.current !== undefined) {
      window.clearTimeout(levelUpEffectTimer.current);
      levelUpEffectTimer.current = undefined;
    }
  }

  useEffect(
    () => () => {
      clearLevelUpEffectTimer();
    },
    [],
  );

  function openLevelUpFlow() {
    clearLevelUpEffectTimer();
    setLevelUpEffect("charged");
    levelUpEffectTimer.current = window.setTimeout(() => {
      levelUpEffectTimer.current = undefined;
      setLevelUpEffect("idle");
      setLeveling(true);
    }, 320);
  }

  function confirmLevelUp(
    selection: LevelUpSelection,
    spellSeedPlans: LevelUpSpellSeedPlan[],
    languages?: CharacterBuild["languages"],
  ) {
    setBuild((b) => {
      const next = applyLevelUp(b, selection);
      let seeded = languages ? { ...next, languages } : next;
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
    selectTab("character");
    setLeveling(false);
    clearLevelUpEffectTimer();
    setLevelUpEffect("idle");
    levelUpEffectTimer.current = window.setTimeout(() => {
      setLevelUpEffect("celebrating");
      levelUpEffectTimer.current = window.setTimeout(() => {
        levelUpEffectTimer.current = undefined;
        setLevelUpEffect("idle");
      }, 700);
    }, 50);
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
    activatableBlockedReasons,
    resourceMaxes,
    resourceLabels,
    resourcePools,
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
    resetWeaponAttackHistory,
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
    healthStatus,
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

  const viewingLatestLevel = currentLevel >= build.levels.length;

  function updateCharacterDetails(
    next: CharacterDetails,
    immediate = activeTab === "character",
  ) {
    setDetails(next);
    if (immediate) flushDetails();
  }

  function completeRest() {
    // Core PF1e natural healing restores one hit point per character level.
    // Campaign-specific full recovery is currently GM-only workspace data, so
    // this remains the safe rules default for player-owned sheets.
    applyHealing(Math.max(1, effectiveBuild.levels.length));
    healNonlethal(nonlethalDamage);
    setTempHp(0);
    setFlag("fatigued", false);
    for (const id of restorableAbilityResourceIds(
      resourceMaxes,
      runtimeBuffs.map((buff) => buff.id),
    ))
      resetResource(id);
    for (const caster of sheet.spellcasting) {
      resetSpellClassRuntime(
        caster.className.toLowerCase(),
        Object.keys(caster.selectionDiagnostics).map(Number),
      );
    }
    setResting(false);
  }

  const availableSpellTargets = characterId
    ? listCharacters(accountStorage)
    : [];

  function requestSpellCast(
    classKey: string,
    level: number,
    max: number,
    spellName: string,
    remaining: number,
  ) {
    setPendingSpellCast({ classKey, level, max, spellName, remaining });
    setSpellTargetIds(characterId ? [characterId] : []);
  }

  function confirmSpellCast() {
    if (!pendingSpellCast) return;
    if (activeTab !== "character") flushSection();
    castSpell(
      pendingSpellCast.classKey,
      pendingSpellCast.level,
      pendingSpellCast.max,
      pendingSpellCast.spellName,
      pendingSpellCast.remaining,
      !!characterId && spellTargetIds.includes(characterId),
    );
    setPendingSpellCast(undefined);
  }

  return (
    <SectionSaveProvider
      save={flushSection}
      className={`app level-up-effect-${levelUpEffect}`}
    >
      <div className="level-up-sheet-effect" aria-hidden="true">
        <span className="level-up-aura" />
        <span className="level-up-edge level-up-edge-top" />
        <span className="level-up-edge level-up-edge-right" />
        <span className="level-up-edge level-up-edge-bottom" />
        <span className="level-up-edge level-up-edge-left" />
        <span className="level-up-sigil level-up-sigil-tl">◇</span>
        <span className="level-up-sigil level-up-sigil-tr">◇</span>
        <span className="level-up-sigil level-up-sigil-br">◇</span>
        <span className="level-up-sigil level-up-sigil-bl">◇</span>
        <span className="level-up-celebration-sweep" />
      </div>
      <div className="level-up-status" role="status" aria-live="polite">
        {levelUpEffect === "celebrating"
          ? `Level ${build.levels.length} gained`
          : ""}
      </div>
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
        </div>
        <HeaderProfile />
      </header>

      <CharacterIdentityBar
        build={effectiveBuild}
        currentHp={currentHp}
        details={details}
        onChange={(next) => updateCharacterDetails(next, true)}
        tempHp={tempHp}
        healthCondition={healthStatus.condition}
        sheet={sheet}
      />

      <nav
        className="tab-bar character-tab-bar"
        aria-label="Character workspace"
      >
        {(
          [
            ["notes", "Notes"],
            ["character", "Character"],
            ["inventory", "Inventory"],
            ["magic", "Magic"],
            ["build", "Build"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            className={activeTab === tab ? "tab-button active" : "tab-button"}
            onClick={() => selectTab(tab)}
          >
            {label}
          </button>
        ))}
      </nav>

      {mountedTabs.notes ? (
        <div hidden={activeTab !== "notes"} className="character-tab-panel">
          <CharacterNotes
            active={activeTab === "notes"}
            characterId={characterId}
            notes={details.notes ?? []}
            onChange={(notes) => {
              if (characterId && !cacheWritable()) return false;
              // Read current profile fields at flush time, including route cleanup.
              const current = characterId
                ? getCharacter(accountStorage, characterId)?.details
                : details;
              if (characterId && !getCharacter(accountStorage, characterId))
                return false;
              updateCharacterDetails({ ...current, notes }, true);
              return true;
            }}
          />
        </div>
      ) : null}

      <div hidden={activeTab !== "character"}>
        <div
          className={
            effectsRailOpen
              ? "character-workspace-frame"
              : "character-workspace-frame rail-collapsed"
          }
        >
          <main className="character-workspace-main">
            <div className="sheet-main-stack">
              <Sheet
                languagesPanel={
                  <CharacterLanguages build={effectiveBuild} hideHeading />
                }
                characterId={characterId}
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
                onRest={() => setResting(true)}
                campaignTraits={details.campaignTraits}
                referenceRuntime={{
                  activatableGroups,
                  activatableBlockedReasons,
                  activeBuffs,
                  resourcesUsed,
                  resourceMaxes,
                  resourceLabels,
                  onSetToggle: setToggle,
                  onSetExclusiveToggleGroup: setExclusiveToggleGroup,
                  onAdjustResource: adjustResource,
                }}
                spellCastCounts={spellCastCounts}
                onCastSpell={requestSpellCast}
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
                showIdentity={false}
                showSpellcasting={false}
              />
              <CombatLogPanel
                combatEventLog={combatEventLog}
                onClearCombatEventLog={clearCombatEventLog}
              />
              <ValidationPanel errors={errors} />
            </div>
          </main>
          <aside
            className="character-effects-rail"
            aria-label="Abilities and Effects"
          >
            <div className="character-rail-heading">
              {effectsRailOpen ? <h2>Abilities &amp; Effects</h2> : null}
              <button
                type="button"
                className="ghost character-rail-toggle"
                onClick={() => setEffectsRailOpen((open) => !open)}
                aria-expanded={effectsRailOpen}
                aria-label={
                  effectsRailOpen
                    ? "Collapse abilities and effects rail"
                    : "Expand abilities and effects rail"
                }
              >
                {effectsRailOpen ? "›" : "‹"}
              </button>
            </div>
            {effectsRailOpen ? (
              <RuntimeControlsPanel
                runtimeFlags={runtime.runtimeState.flags}
                onApplyRuntimeActions={runtime.applyActions}
                showHeading={false}
                activatableGroups={activatableGroups}
                activatableConflicts={activatableConflicts}
                activatableBlockedReasons={activatableBlockedReasons}
                activeBuffs={activeBuffs}
                resourcesUsed={resourcesUsed}
                resourceMaxes={resourceMaxes}
                resourceLabels={resourceLabels}
                resourcePools={resourcePools}
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
            ) : null}
          </aside>
        </div>
      </div>

      {mountedTabs.inventory ? (
        <SaveSection hidden={activeTab !== "inventory"}>
          <GearTab
            characterId={characterId}
            sheet={sheet}
            build={build}
            onAdjustCoinPurse={adjustCoinPurse}
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
        </SaveSection>
      ) : null}

      {mountedTabs.magic ? (
        <SaveSection
          hidden={activeTab !== "magic"}
          className="character-tab-panel"
        >
          <div className="magic-workspace">
            <header className="character-section-header">
              <div>
                <span className="character-eyebrow">
                  Cast, prepare, and review
                </span>
                <h2>Magic</h2>
              </div>
              <span className="chip">
                {sheet.spellcasting.length} source
                {sheet.spellcasting.length === 1 ? "" : "s"}
              </span>
            </header>
            <SpellcastingManager
              characterId={characterId}
              onAddSource={() => selectTab("build")}
              defaultOpen
              casters={sheet.spellcasting}
              classArchetypes={build.classArchetypes}
              spellOptions={SPELL_OPTIONS}
              domainOptions={DOMAIN_OPTIONS}
              schoolOptions={SCHOOL_OPTIONS}
              spellCastCounts={spellCastCounts}
              spellSuggestions={suggestionBundle.spellChoices}
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
              onCastSpell={requestSpellCast}
              onResetSpellSlotLevel={resetSpellSlotLevel}
              onResetSpellRuntimeClass={resetSpellClassRuntime}
            />
          </div>
        </SaveSection>
      ) : null}

      {mountedTabs.build ? (
        <SaveSection
          hidden={activeTab !== "build"}
          className="character-build-tab"
        >
          {!characterId ? (
            <div className="build-slots-wrap">
              <BuildSlotsPanel
                savedBuildSlots={savedBuildSlots}
                onSaveNewBuildSlot={saveNewBuildSlot}
                onResetCurrentBuild={resetCurrentBuild}
                onLoadBuildSlot={loadBuildSlotById}
                onOverwriteBuildSlot={overwriteBuildSlot}
                onDeleteBuildSlot={deleteBuildSlot}
              />
            </div>
          ) : null}
          <BuildEditorTab
            characterId={characterId}
            advancementActions={
              <div className="build-action-bar">
                <div>
                  <span className="character-eyebrow">Advancement</span>
                  <strong>
                    Level {currentLevel} of {build.levels.length}
                  </strong>
                </div>
                <div className="actions">
                  {viewingLatestLevel ? (
                    <HoldToActivateButton
                      disabled={leveling || levelUpEffect === "charged"}
                      onHoldStart={() => setLevelUpEffect("holding")}
                      onHoldCancel={() => setLevelUpEffect("idle")}
                      onComplete={openLevelUpFlow}
                    />
                  ) : (
                    <button onClick={advanceLevel}>→ Next Level</button>
                  )}
                  <button
                    className="ghost"
                    disabled={currentLevel <= 1}
                    onClick={undoCurrentLevel}
                  >
                    ↩ Undo Level
                  </button>
                </div>
              </div>
            }
            campaignTraitsPanel={
              <BuildSection
                characterId={characterId ?? "local"}
                title="Campaign Traits"
                eyebrow="Optional campaign choices"
                className="build-traits-panel"
                actions={
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() =>
                      updateCharacterDetails({
                        ...details,
                        campaignTraits: [...(details.campaignTraits ?? []), ""],
                      })
                    }
                  >
                    + Trait
                  </button>
                }
              >
                <SaveSection>
                  {(details.campaignTraits ?? []).length ? (
                    <div className="character-trait-list">
                      {(details.campaignTraits ?? []).map((trait, index) => (
                        <div
                          className="character-trait-row"
                          key={`campaign-trait-${index}`}
                        >
                          <input
                            aria-label={`Campaign trait ${index + 1}`}
                            value={trait}
                            placeholder="Trait name or campaign-granted benefit"
                            onChange={(event) =>
                              updateCharacterDetails({
                                ...details,
                                campaignTraits: (
                                  details.campaignTraits ?? []
                                ).map((value, entryIndex) =>
                                  entryIndex === index
                                    ? event.target.value
                                    : value,
                                ),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="ghost small"
                            onClick={() =>
                              updateCharacterDetails({
                                ...details,
                                campaignTraits: (
                                  details.campaignTraits ?? []
                                ).filter(
                                  (_, entryIndex) => entryIndex !== index,
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="hint">
                      Optional. Most campaigns allow one to three traits,
                      subject to the GM’s creation rules.
                    </p>
                  )}
                </SaveSection>
              </BuildSection>
            }
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
            showSpellcasting={false}
            onUpdateName={(name) => setBuild((prev) => ({ ...prev, name }))}
            onUpdateLanguages={(languages) =>
              setBuild((prev) => ({ ...prev, languages }))
            }
            onUpdateAlignment={updateAlignment}
            onUpdateBaseAbilityScore={updateBaseAbilityScore}
            onUpdateRace={updateRace}
            onUpdateRaceFlexibleAbility={updateRaceFlexibleAbility}
            onUpdateRaceBonusFeat={updateRaceBonusFeat}
            onToggleRaceAlternateTrait={toggleRaceAlternateTrait}
            onUpdateFavoredClassName={updateFavoredClassName}
            onUpdateFirearmRulesMode={updateFirearmRulesMode}
            onUpdateClassArchetypes={updateClassArchetypes}
            onUpdateInfantrymanGunTraining={updateInfantrymanGunTraining}
            onUpdateIgnoreAlignmentRestrictions={
              updateIgnoreAlignmentRestrictions
            }
            onUpdateIgnoreEncumbrance={updateIgnoreEncumbrance}
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
            onUpdateTotalSkillRank={updateTotalSkillRank}
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
            onCastSpell={requestSpellCast}
            onResetSpellSlotLevel={resetSpellSlotLevel}
            onResetSpellRuntimeClass={resetSpellClassRuntime}
          />
        </SaveSection>
      ) : null}

      {resting ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setResting(false)}
        >
          <section
            className="modal character-rest-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rest-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="character-eyebrow">Recovery</span>
                <h2 id="rest-dialog-title">Take a Rest</h2>
              </div>
            </div>
            <p>
              Core recovery restores {Math.max(1, effectiveBuild.levels.length)}{" "}
              HP, clears nonlethal damage and fatigue, and restores spell slots
              and daily resource pools. Prepared spells remain prepared.
            </p>
            <div className="rest-summary-grid">
              <div>
                <span>HP after rest</span>
                <strong>
                  {Math.min(
                    sheet.hitPoints.total,
                    currentHp + Math.max(1, effectiveBuild.levels.length),
                  )}{" "}
                  / {sheet.hitPoints.total}
                </strong>
              </div>
              <div>
                <span>Spell sources</span>
                <strong>{sheet.spellcasting.length}</strong>
              </div>
              <div>
                <span>Daily pools</span>
                <strong>{resourcePools.length}</strong>
              </div>
            </div>
            <p className="hint">
              Campaign-specific full recovery is applied where the campaign
              grants sheet access to that rule; otherwise Pathfinder core
              recovery is the safe default.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setResting(false)}
              >
                Cancel
              </button>
              <button type="button" onClick={completeRest}>
                Complete Rest
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingSpellCast ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setPendingSpellCast(undefined)}
        >
          <section
            className="modal spell-target-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spell-target-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="character-eyebrow">Resolve at the table</span>
                <h2 id="spell-target-title">
                  Choose targets for {pendingSpellCast.spellName}
                </h2>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setPendingSpellCast(undefined)}
              >
                Close
              </button>
            </div>
            <p>
              Select every character affected. Area placement is resolved on
              your physical or shared table. The spell slot is spent when you
              confirm. Supported effects apply here only if this character is
              selected. Other recipients add the effect on their own sheets
              after resolving any saving throw.
            </p>
            <div className="spell-target-list">
              {availableSpellTargets.length ? (
                availableSpellTargets.map((target) => (
                  <label key={target.id}>
                    <input
                      type="checkbox"
                      checked={spellTargetIds.includes(target.id)}
                      onChange={(event) =>
                        setSpellTargetIds((current) =>
                          event.target.checked
                            ? [...current, target.id]
                            : current.filter((id) => id !== target.id),
                        )
                      }
                    />
                    <span>
                      <strong>{target.name}</strong>
                      {target.build.race.name} · Level {target.currentLevel}
                    </span>
                  </label>
                ))
              ) : (
                <p className="hint">
                  No campaign characters are available in this local preview.
                  You can still confirm a spell with no tracked target.
                </p>
              )}
            </div>
            <p className="hint">
              Saving throws are resolved by each affected character’s player, or
              by the GM for campaign actors.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setPendingSpellCast(undefined)}
              >
                Cancel
              </button>
              <button type="button" onClick={confirmSpellCast}>
                Cast on {spellTargetIds.length || "no tracked"} target
                {spellTargetIds.length === 1 ? "" : "s"}
              </button>
            </div>
          </section>
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
          onConfirm={confirmLevelUp}
          onClose={() => {
            setLeveling(false);
            setLevelUpEffect("idle");
          }}
        />
      ) : null}
    </SectionSaveProvider>
  );
}
