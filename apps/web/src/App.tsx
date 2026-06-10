import { useEffect, useMemo, useState } from "react";
import {
  activatableResourceMax,
  applyLevelUp,
  buildCharacter,
  CLASS_FEATURES,
  collectActivatableEffects,
  computeSheet,
  FEATS,
  groupActivatables,
  levelDown,
  listFeats,
  resolveActivatableSelections,
  SAMPLE_CLASSES,
  SKILL_DEFINITIONS,
  SPELLS,
  validateBuild,
  type AbilityKey,
  type ActivationContext,
  type CharacterBuild,
  type LevelUpSelection,
  type Modifier,
  type SkillKey,
  type SpellSlotUsageByLevel,
} from "@mathfinder/rules-engine";
import { BUFFS, initialBuild, SAMPLE_RACES } from "./data";
import { Sheet } from "./components/Sheet";
import { LevelUpModal } from "./components/LevelUpModal";
import { BuildEditorTab } from "./components/BuildEditorTab";

type SpellCastCounts = Record<string, Record<number, Record<string, number>>>;

const ABILITY_ORDER: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SKILL_NAME = new Map<string, string>(SKILL_DEFINITIONS.map((d) => [d.key, d.name]));
const CLASS_OPTIONS = Object.values(SAMPLE_CLASSES).sort((a, b) => a.name.localeCompare(b.name));
const RACE_OPTIONS = Object.entries(SAMPLE_RACES).sort((a, b) => a[1].name.localeCompare(b[1].name));
const RUNTIME_STORAGE_KEY = "mathfinder:web-runtime:v1";
const SPELL_OPTIONS = Object.values(SPELLS).sort((a, b) => a.name.localeCompare(b.name));
const CURRENT_BUILD_STORAGE_KEY = "mathfinder:web-build:v1";
const BUILD_SLOTS_STORAGE_KEY = "mathfinder:web-build-slots:v1";

interface RuntimeStateSnapshot {
  activeBuffs: Record<string, boolean>;
  resourcesUsed: Record<string, number>;
  spellSlotUsage: Record<string, SpellSlotUsageByLevel>;
  spellCastCounts: SpellCastCounts;
  fatigued: boolean;
}

interface SavedBuildSlot {
  id: string;
  label: string;
  savedAt: string;
  build: CharacterBuild;
}

interface EquipmentArmorEditorState {
  category: "none" | "light" | "medium" | "heavy";
  maxDexBonus?: number;
  checkPenalty?: number;
  speedPenalty?: number;
}

function loadRuntimeState(): RuntimeStateSnapshot {
  if (typeof window === "undefined") {
    return {
      activeBuffs: {},
      resourcesUsed: {},
      spellSlotUsage: {},
      spellCastCounts: {},
      fatigued: false,
    };
  }
  try {
    const raw = window.localStorage.getItem(RUNTIME_STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<RuntimeStateSnapshot>;
    return {
      activeBuffs: parsed.activeBuffs ?? {},
      resourcesUsed: parsed.resourcesUsed ?? {},
      spellSlotUsage: parsed.spellSlotUsage ?? {},
      spellCastCounts: parsed.spellCastCounts ?? {},
      fatigued: parsed.fatigued ?? false,
    };
  } catch {
    return {
      activeBuffs: {},
      resourcesUsed: {},
      spellSlotUsage: {},
      spellCastCounts: {},
      fatigued: false,
    };
  }
}

function loadCurrentBuild(): CharacterBuild {
  if (typeof window === "undefined") return initialBuild;
  try {
    const raw = window.localStorage.getItem(CURRENT_BUILD_STORAGE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw) as CharacterBuild;
  } catch {
    return initialBuild;
  }
}

function loadBuildSlots(): SavedBuildSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BUILD_SLOTS_STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as SavedBuildSlot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const [runtimeState] = useState(loadRuntimeState);
  const [build, setBuild] = useState<CharacterBuild>(loadCurrentBuild);
  const [savedBuildSlots, setSavedBuildSlots] = useState<SavedBuildSlot[]>(loadBuildSlots);
  const [activeBuffs, setActiveBuffs] = useState<Record<string, boolean>>(runtimeState.activeBuffs);
  const [leveling, setLeveling] = useState(false);
  const [resourcesUsed, setResourcesUsed] = useState<Record<string, number>>(runtimeState.resourcesUsed);
  const [spellSlotUsage, setSpellSlotUsage] = useState<Record<string, SpellSlotUsageByLevel>>(runtimeState.spellSlotUsage);
  const [spellCastCounts, setSpellCastCounts] = useState<SpellCastCounts>(runtimeState.spellCastCounts);
  const [fatigued, setFatigued] = useState(runtimeState.fatigued);
  const [activeTab, setActiveTab] = useState<"sheet" | "build">("sheet");
  function confirmLevelUp(selection: LevelUpSelection) {
    setBuild((b) => applyLevelUp(b, selection));
    setLeveling(false);
  }

  function resetRuntimeState() {
    setActiveBuffs({});
    setResourcesUsed({});
    setSpellSlotUsage({});
    setSpellCastCounts({});
    setFatigued(false);
  }

  function saveNewBuildSlot() {
    const now = new Date().toISOString();
    const slot: SavedBuildSlot = {
      id: `${Date.now()}`,
      label: `${build.name} (L${build.levels.length})`,
      savedAt: now,
      build,
    };
    setSavedBuildSlots((prev) => [slot, ...prev]);
  }

  function overwriteBuildSlot(slotId: string) {
    const now = new Date().toISOString();
    setSavedBuildSlots((prev) => prev.map((slot) =>
      slot.id === slotId
        ? { ...slot, label: `${build.name} (L${build.levels.length})`, savedAt: now, build }
        : slot
    ));
  }

  function loadBuildSlot(slot: SavedBuildSlot) {
    setBuild(slot.build);
    resetRuntimeState();
    setLeveling(false);
  }

  function deleteBuildSlot(slotId: string) {
    setSavedBuildSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }

  function resetCurrentBuild() {
    setBuild(initialBuild);
    resetRuntimeState();
    setLeveling(false);
  }

  function updateBaseAbilityScore(ability: AbilityKey, value: number) {
    setBuild((prev) => ({
      ...prev,
      baseAbilityScores: {
        ...prev.baseAbilityScores,
        [ability]: Math.max(1, value),
      },
    }));
  }

  function updateRace(raceKey: string) {
    const nextRace = SAMPLE_RACES[raceKey];
    if (!nextRace) return;
    setBuild((prev) => ({ ...prev, race: nextRace }));
  }

  function updateCarriedWeight(raw: string) {
    setBuild((prev) => ({
      ...prev,
      carriedWeight: raw === "" ? undefined : Math.max(0, Number(raw) || 0),
    }));
  }

  function updateLevelField<K extends keyof CharacterBuild["levels"][number]>(
    levelIndex: number,
    key: K,
    value: CharacterBuild["levels"][number][K],
  ) {
    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.map((level, i) => (i === levelIndex ? { ...level, [key]: value } : level)),
    }));
  }

  function addStructureLevel() {
    const lastClassName = build.levels[build.levels.length - 1]?.className ?? CLASS_OPTIONS[0]?.name ?? "Fighter";
    const classKey = Object.keys(SAMPLE_CLASSES).find(
      (key) => SAMPLE_CLASSES[key]?.name.toLowerCase() === lastClassName.toLowerCase(),
    );
    const hitDie = classKey ? SAMPLE_CLASSES[classKey]?.hitDie ?? 8 : 8;
    setBuild((prev) => ({
      ...prev,
      levels: [
        ...prev.levels,
        {
          className: lastClassName,
          hitPointRoll: Math.max(1, Math.ceil(hitDie / 2)),
          skillRanks: {},
          modifiers: [],
        },
      ],
    }));
  }

  function removeStructureLevel(levelIndex: number) {
    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.filter((_, i) => i !== levelIndex),
    }));
  }

  function addWeapon() {
    setBuild((prev) => ({
      ...prev,
      weapons: [
        ...(prev.weapons ?? []),
        { name: "New Weapon", category: "melee", damageDice: "1d6", handedness: "one", critMultiplier: 2, critRange: 20 },
      ],
    }));
  }

  function updateWeapon(index: number, patch: Partial<NonNullable<CharacterBuild["weapons"]>[number]>) {
    setBuild((prev) => ({
      ...prev,
      weapons: (prev.weapons ?? []).map((weapon, i) => (i === index ? { ...weapon, ...patch } : weapon)),
    }));
  }

  function removeWeapon(index: number) {
    setBuild((prev) => ({
      ...prev,
      weapons: (prev.weapons ?? []).filter((_, i) => i !== index),
    }));
  }

  function addEquipment() {
    setBuild((prev) => ({
      ...prev,
      equipment: [
        ...(prev.equipment ?? []),
        { name: "New Item", quantity: 1, weight: 0, costGp: 0, equipped: false },
      ],
    }));
  }

  function updateEquipment(index: number, patch: Partial<NonNullable<CharacterBuild["equipment"]>[number]>) {
    setBuild((prev) => ({
      ...prev,
      equipment: (prev.equipment ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateEquipmentArmor(index: number, patch: EquipmentArmorEditorState) {
    setBuild((prev) => ({
      ...prev,
      equipment: (prev.equipment ?? []).map((item, i) =>
        i === index
          ? {
              ...item,
              armor: patch.category === "none"
                ? undefined
                : {
                    category: patch.category,
                    maxDexBonus: patch.maxDexBonus,
                    checkPenalty: patch.checkPenalty,
                    speedPenalty: patch.speedPenalty,
                  },
            }
          : item,
      ),
    }));
  }

  function removeEquipment(index: number) {
    setBuild((prev) => ({
      ...prev,
      equipment: (prev.equipment ?? []).filter((_, i) => i !== index),
    }));
  }

  function updateLevelFeats(levelIndex: number, feats: string[]) {
    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.map((level, i) => (i === levelIndex ? { ...level, feats } : level)),
    }));
  }

  function addLevelFeat(levelIndex: number) {
    const current = build.levels[levelIndex]?.feats ?? [];
    updateLevelFeats(levelIndex, [...current, ""]);
  }

  function removeLevelFeat(levelIndex: number, featIndex: number) {
    const current = build.levels[levelIndex]?.feats ?? [];
    updateLevelFeats(levelIndex, current.filter((_, i) => i !== featIndex));
  }

  function updateLevelFeatName(levelIndex: number, featIndex: number, value: string) {
    const current = [...(build.levels[levelIndex]?.feats ?? [])];
    current[featIndex] = value;
    updateLevelFeats(levelIndex, current);
  }

  function updateLevelSkillRank(levelIndex: number, skillKey: SkillKey, value: number) {
    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.map((level, i) => {
        if (i !== levelIndex) return level;
        const current = { ...(level.skillRanks ?? {}) };
        if (value <= 0) delete current[skillKey];
        else current[skillKey] = value;
        return { ...level, skillRanks: current };
      }),
    }));
  }

  function updateSpellSelections(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
    spells: string[],
  ) {
    setBuild((prev) => ({
      ...prev,
      spellSelections: {
        ...(prev.spellSelections ?? {}),
        [classKey]: {
          ...((prev.spellSelections ?? {})[classKey] ?? {}),
          [mode]: {
            ...(((prev.spellSelections ?? {})[classKey]?.[mode] ?? {})),
            [level]: spells,
          },
        },
      },
    }));
  }

  function addSpellSelection(classKey: string, mode: "prepared" | "known", level: number) {
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    updateSpellSelections(classKey, mode, level, [...current, ""]);
  }

  function updateSpellSelectionName(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
    index: number,
    value: string,
  ) {
    const current = [...(build.spellSelections?.[classKey]?.[mode]?.[level] ?? [])];
    current[index] = value;
    updateSpellSelections(classKey, mode, level, current);
  }

  function removeSpellSelection(classKey: string, mode: "prepared" | "known", level: number, index: number) {
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    updateSpellSelections(classKey, mode, level, current.filter((_, i) => i !== index));
  }

  function resetSpellSelectionsForLevel(classKey: string, mode: "prepared" | "known", level: number) {
    updateSpellSelections(classKey, mode, level, []);
  }

  function appendSpellSelection(classKey: string, mode: "prepared" | "known", level: number, spellName: string) {
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    updateSpellSelections(classKey, mode, level, [...current, spellName]);
  }

  function resetSpellSelectionsForClass(classKey: string, mode: "prepared" | "known", levels: number[]) {
    setBuild((prev) => ({
      ...prev,
      spellSelections: {
        ...(prev.spellSelections ?? {}),
        [classKey]: {
          ...((prev.spellSelections ?? {})[classKey] ?? {}),
          [mode]: Object.fromEntries(levels.map((level) => [level, []])),
        },
      },
    }));
  }

  function updateSpellLibrary(classKey: string, level: number, spells: string[]) {
    setBuild((prev) => ({
      ...prev,
      spellLibrary: {
        ...(prev.spellLibrary ?? {}),
        [classKey]: {
          ...((prev.spellLibrary ?? {})[classKey] ?? {}),
          [level]: spells,
        },
      },
    }));
  }

  function addSpellLibraryEntry(classKey: string, level: number) {
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellLibrary(classKey, level, [...current, ""]);
  }

  function appendSpellLibraryEntry(classKey: string, level: number, spellName: string) {
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellLibrary(classKey, level, [...current, spellName]);
  }

  function updateSpellLibraryName(classKey: string, level: number, index: number, value: string) {
    const current = [...(build.spellLibrary?.[classKey]?.[level] ?? [])];
    current[index] = value;
    updateSpellLibrary(classKey, level, current);
  }

  function removeSpellLibraryEntry(classKey: string, level: number, index: number) {
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellLibrary(classKey, level, current.filter((_, i) => i !== index));
  }

  function resetSpellLibraryLevel(classKey: string, level: number) {
    updateSpellLibrary(classKey, level, []);
  }

  function resetSpellLibraryForClass(classKey: string, levels: number[]) {
    setBuild((prev) => ({
      ...prev,
      spellLibrary: {
        ...(prev.spellLibrary ?? {}),
        [classKey]: Object.fromEntries(levels.map((level) => [level, []])),
      },
    }));
  }

  function fillSelectionsFromLibrary(classKey: string, mode: "prepared" | "known", level: number, capacity: number) {
    const source = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellSelections(classKey, mode, level, source.slice(0, capacity));
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot: RuntimeStateSnapshot = {
      activeBuffs,
      resourcesUsed,
      spellSlotUsage,
      spellCastCounts,
      fatigued,
    };
    window.localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(snapshot));
  }, [activeBuffs, resourcesUsed, spellSlotUsage, spellCastCounts, fatigued]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CURRENT_BUILD_STORAGE_KEY, JSON.stringify(build));
  }, [build]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BUILD_SLOTS_STORAGE_KEY, JSON.stringify(savedBuildSlots));
  }, [savedBuildSlots]);

  // The whole app is a pure render of (build + active buffs). Toggle anything
  // and every derived number recomputes instantly — the engine is fast & local.
  const { sheet, issues, activatableGroups, activatableConflicts, resourceMaxes } = useMemo(() => {
    const input = buildCharacter({
      ...build,
      conditions: fatigued ? ["fatigued"] : [],
      spellSlotUsage,
    });
    const baseSheet = computeSheet(input);
    const activatableFeatures = collectActivatableEffects({
      descriptor: baseSheet.descriptor,
      classFeatureRegistry: CLASS_FEATURES,
      featRegistry: FEATS,
    });
    const abilityModifiers = Object.fromEntries(
      (["str", "dex", "con", "int", "wis", "cha"] as AbilityKey[]).map((k) => [
        k,
        baseSheet.abilities[k].mod,
      ]),
    ) as Record<AbilityKey, number>;
    const context: ActivationContext = {
      baseAttackBonus: baseSheet.baseAttackBonus,
      characterLevel: baseSheet.level,
      abilityModifiers,
    };
    const resourceMaxes: Record<string, number> = {};
    for (const f of activatableFeatures) {
      const max = activatableResourceMax(f, context);
      if (max !== undefined) resourceMaxes[f.id] = max;
    }
    const resolvedActivatables = resolveActivatableSelections({
      available: activatableFeatures,
      selected: activeBuffs,
      context,
    });
    const classAbilityMods: Modifier[] = resolvedActivatables.modifiers;
    const buffMods: Modifier[] = BUFFS.filter((b) => activeBuffs[b.id]).flatMap(
      (b) => b.modifiers,
    );
    const withBuffs = { ...input, modifiers: [...input.modifiers, ...classAbilityMods, ...buffMods] };
    return {
      sheet: computeSheet(withBuffs),
      issues: validateBuild(build),
      activatableFeatures,
      activatableGroups: groupActivatables(activatableFeatures),
      activatableConflicts: resolvedActivatables.conflicts,
      resourceMaxes,
    };
  }, [build, activeBuffs, fatigued, spellSlotUsage]);

  const errors = issues.filter((i) => i.severity === "error");
  const featOptions = listFeats(FEATS).map((feat) => feat.name).sort((a, b) => a.localeCompare(b));

  function resourceControls(featureId: string) {
    const max = resourceMaxes[featureId];
    if (max === undefined) return null;
    const used = Math.min(resourcesUsed[featureId] ?? 0, max);
    const remaining = Math.max(0, max - used);
    return (
      <div className="resource-row">
        <span className="resource-label">{remaining}/{max} left</span>
        <div className="resource-buttons">
          <button
            className="ghost small"
            onClick={() =>
              setResourcesUsed((prev) => ({ ...prev, [featureId]: Math.max(0, (prev[featureId] ?? 0) - 1) }))
            }
          >
            -
          </button>
          <button
            className="ghost small"
            onClick={() =>
              setResourcesUsed((prev) => ({ ...prev, [featureId]: Math.min(max, (prev[featureId] ?? 0) + 1) }))
            }
          >
            +
          </button>
          <button
            className="ghost small"
            onClick={() => setResourcesUsed((prev) => ({ ...prev, [featureId]: 0 }))}
          >
            Rest
          </button>
        </div>
      </div>
    );
  }

  function adjustSpellSlot(classKey: string, level: number, max: number, delta: number) {
    setSpellSlotUsage((prev) => ({
      ...prev,
      [classKey]: {
        ...(prev[classKey] ?? {}),
        [level]: Math.min(max, Math.max(0, ((prev[classKey] ?? {})[level] ?? 0) + delta)),
      },
    }));
  }

  function castSpell(classKey: string, level: number, max: number, spellName: string, remaining: number) {
    if (remaining <= 0) return;
    adjustSpellSlot(classKey, level, max, 1);
    setSpellCastCounts((prev) => ({
      ...prev,
      [classKey]: {
        ...(prev[classKey] ?? {}),
        [level]: {
          ...((prev[classKey] ?? {})[level] ?? {}),
          [spellName]: (((prev[classKey] ?? {})[level] ?? {})[spellName] ?? 0) + 1,
        },
      },
    }));
  }

  function resetSpellClassRuntime(classKey: string, levels: number[]) {
    setSpellSlotUsage((prev) => ({
      ...prev,
      [classKey]: Object.fromEntries(levels.map((level) => [level, 0])),
    }));
    setSpellCastCounts((prev) => ({
      ...prev,
      [classKey]: {},
    }));
  }

  function resetSpellSlotLevel(classKey: string, level: number) {
    setSpellSlotUsage((prev) => ({
      ...prev,
      [classKey]: {
        ...(prev[classKey] ?? {}),
        [level]: 0,
      },
    }));
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          Mathfinder <span className="brand-sub">Pathfinder 1e smart sheet</span>
        </div>
        <div className="actions">
          <button onClick={() => setLeveling(true)}>⬆ Level Up</button>
          <button className="ghost" disabled={build.levels.length <= 1} onClick={() => setBuild((b) => levelDown(b))}>
            ↩ Undo Level
          </button>
        </div>
      </header>

      <div className="tab-bar">
        <button className={activeTab === "sheet" ? "tab-button active" : "tab-button"} onClick={() => setActiveTab("sheet")}>Sheet</button>
        <button className={activeTab === "build" ? "tab-button active" : "tab-button"} onClick={() => setActiveTab("build")}>Build</button>
      </div>

      {activeTab === "build" ? (
        <BuildEditorTab
          build={build}
          sheetSpellcasting={sheet.spellcasting}
          abilityOrder={ABILITY_ORDER}
          raceOptions={RACE_OPTIONS}
          classOptions={CLASS_OPTIONS}
          featOptions={featOptions}
          skillName={SKILL_NAME}
          spellOptions={SPELL_OPTIONS}
          spellCastCounts={spellCastCounts}
          onUpdateName={(name) => setBuild((prev) => ({ ...prev, name }))}
          onUpdateBaseAbilityScore={updateBaseAbilityScore}
          onUpdateCarriedWeight={updateCarriedWeight}
          onUpdateRace={updateRace}
          onAddStructureLevel={addStructureLevel}
          onRemoveStructureLevel={removeStructureLevel}
          onUpdateLevelField={updateLevelField}
          onAddLevelFeat={addLevelFeat}
          onRemoveLevelFeat={removeLevelFeat}
          onUpdateLevelFeatName={updateLevelFeatName}
          onUpdateLevelSkillRank={updateLevelSkillRank}
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
          onAdjustSpellSlot={adjustSpellSlot}
          onCastSpell={castSpell}
          onResetSpellSlotLevel={resetSpellSlotLevel}
          onResetSpellRuntimeClass={resetSpellClassRuntime}
          onAddWeapon={addWeapon}
          onUpdateWeapon={updateWeapon}
          onRemoveWeapon={removeWeapon}
          onAddEquipment={addEquipment}
          onUpdateEquipment={updateEquipment}
          onUpdateEquipmentArmor={updateEquipmentArmor}
          onRemoveEquipment={removeEquipment}
        />
      ) : (
        <div className="layout sheet-layout">
          <aside className="controls sheet-sidebar">
            <section className="panel">
              <h2>Abilities, Buffs &amp; Auras</h2>
              <p className="hint">Table-state toggles live here. Crunch on the left, pretty sheet on the right.</p>
              {activatableGroups.ungrouped.map((feature) => {
                const max = resourceMaxes[feature.id];
                const used = resourcesUsed[feature.id] ?? 0;
                const activationBlocked = max !== undefined && used >= max && !activeBuffs[feature.id];
                return (
                  <div className="buff-block" key={feature.id}>
                    <label className="buff">
                      <input
                        type="checkbox"
                        disabled={activationBlocked}
                        checked={!!activeBuffs[feature.id]}
                        onChange={(e) => setActiveBuffs((prev) => ({ ...prev, [feature.id]: e.target.checked }))}
                      />
                      <span>
                        <strong>{feature.name} (ability)</strong>
                        <span className="buff-desc">{feature.description}</span>
                      </span>
                    </label>
                    {resourceControls(feature.id)}
                  </div>
                );
              })}
              {Object.entries(activatableGroups.grouped).map(([group, items]) => (
                <div className="mode-group" key={group}>
                  <div className="mode-title">{group.replace(/-/g, " ")}</div>
                  {items.map((feature) => (
                    <div className="buff-block" key={feature.id}>
                      <label className="buff">
                        <input
                          type="radio"
                          name={`mode-${group}`}
                          checked={!!activeBuffs[feature.id]}
                          onChange={() =>
                            setActiveBuffs((prev) => {
                              const next = { ...prev };
                              for (const item of items) next[item.id] = false;
                              next[feature.id] = true;
                              return next;
                            })
                          }
                        />
                        <span>
                          <strong>{feature.name} (ability)</strong>
                          <span className="buff-desc">{feature.description}</span>
                        </span>
                      </label>
                      {resourceControls(feature.id)}
                    </div>
                  ))}
                  <button
                    className="ghost small"
                    onClick={() =>
                      setActiveBuffs((prev) => {
                        const next = { ...prev };
                        for (const item of items) next[item.id] = false;
                        return next;
                      })
                    }
                  >
                    Clear mode
                  </button>
                </div>
              ))}
              {activatableConflicts.length > 0 ? <p className="hint warn-text">Conflicting modes were selected; only one per group applies.</p> : null}
              <div className="mode-group">
                <div className="mode-title">conditions</div>
                <label className="buff">
                  <input type="checkbox" checked={fatigued} onChange={(e) => setFatigued(e.target.checked)} />
                  <span>
                    <strong>Fatigued</strong>
                    <span className="buff-desc">Blocks Rage and can suppress other abilities later.</span>
                  </span>
                </label>
              </div>
              {BUFFS.map((buff) => (
                <label className="buff" key={buff.id}>
                  <input type="checkbox" checked={!!activeBuffs[buff.id]} onChange={(e) => setActiveBuffs((prev) => ({ ...prev, [buff.id]: e.target.checked }))} />
                  <span>
                    <strong>{buff.name}</strong>
                    <span className="buff-desc">{buff.description}</span>
                  </span>
                </label>
              ))}
            </section>

            <section className="panel">
              <h2>Character Saves</h2>
              <p className="hint">Current build autosaves. Slots keep multiple characters handy.</p>
              <div className="save-actions">
                <button className="ghost small" onClick={saveNewBuildSlot}>Save New Slot</button>
                <button className="ghost small" onClick={resetCurrentBuild}>Reset Current</button>
              </div>
              <div className="slot-list">
                {savedBuildSlots.length === 0 ? (
                  <p className="hint">No saved slots yet. Shocking restraint.</p>
                ) : savedBuildSlots.map((slot) => (
                  <div className="slot-row" key={slot.id}>
                    <div className="slot-meta">
                      <strong>{slot.label}</strong>
                      <span className="buff-desc">{new Date(slot.savedAt).toLocaleString()}</span>
                    </div>
                    <div className="resource-buttons">
                      <button className="ghost small" onClick={() => loadBuildSlot(slot)}>Load</button>
                      <button className="ghost small" onClick={() => overwriteBuildSlot(slot.id)}>Overwrite</button>
                      <button className="ghost small" onClick={() => deleteBuildSlot(slot.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {errors.length > 0 ? (
              <section className="panel errors">
                <h2>Validation</h2>
                <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
              </section>
            ) : (
              <section className="panel ok">
                <h2>Validation</h2>
                <p>No issues — this build is legal.</p>
              </section>
            )}
          </aside>

          <main className="main sheet-main">
            <Sheet sheet={sheet} />
          </main>
        </div>
      )}

      {leveling ? <LevelUpModal build={build} onConfirm={confirmLevelUp} onClose={() => setLeveling(false)} /> : null}
    </div>
  );
}
