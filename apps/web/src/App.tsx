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
  type DerivedSpellcasting,
  type LevelUpSelection,
  type Modifier,
  type SkillKey,
  type SpellSlotUsageByLevel,
} from "@path-builder/rules-engine";
import { BUFFS, initialBuild, SAMPLE_RACES } from "./data";
import { Sheet } from "./components/Sheet";
import { LevelUpModal } from "./components/LevelUpModal";

type SpellCastCounts = Record<string, Record<number, Record<string, number>>>;

const ABILITY_ORDER: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SKILL_NAME = new Map<string, string>(SKILL_DEFINITIONS.map((d) => [d.key, d.name]));
const CLASS_OPTIONS = Object.values(SAMPLE_CLASSES).sort((a, b) => a.name.localeCompare(b.name));
const RACE_OPTIONS = Object.entries(SAMPLE_RACES).sort((a, b) => a[1].name.localeCompare(b[1].name));
const RUNTIME_STORAGE_KEY = "path-builder:web-runtime:v1";
const SPELL_OPTIONS = Object.values(SPELLS).sort((a, b) => a.name.localeCompare(b.name));
const CURRENT_BUILD_STORAGE_KEY = "path-builder:web-build:v1";
const BUILD_SLOTS_STORAGE_KEY = "path-builder:web-build-slots:v1";

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

  function spellSlotControls(caster: DerivedSpellcasting) {
    const classKey = caster.className.toLowerCase();
    const levels = Object.keys(caster.spellsPerDay)
      .map(Number)
      .sort((a, b) => a - b);
    return (
      <div className="mode-group" key={classKey}>
        <div className="mode-title">{caster.className} spell slots</div>
        {levels.map((level) => {
          const max = caster.spellsPerDay[level] ?? 0;
          const used = caster.slotsUsed[level] ?? 0;
          const remaining = caster.slotsRemaining[level] ?? max;
          const spells = caster.castingType === "prepared"
            ? (caster.selectedPreparedSpells[level] ?? [])
            : (caster.selectedKnownSpells[level] ?? []);
          return (
            <div className="spell-runtime-block" key={`${classKey}-${level}`}>
              <div className="resource-row">
                <span className="resource-label">L{level}: {remaining}/{max} left</span>
                <div className="resource-buttons">
                  <button
                    className="ghost small"
                    onClick={() => adjustSpellSlot(classKey, level, max, -1)}
                  >
                    -
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => adjustSpellSlot(classKey, level, max, 1)}
                  >
                    +
                  </button>
                  <button
                    className="ghost small"
                    onClick={() =>
                      setSpellSlotUsage((prev) => ({
                        ...prev,
                        [classKey]: {
                          ...(prev[classKey] ?? {}),
                          [level]: 0,
                        },
                      }))
                    }
                  >
                    Rest
                  </button>
                </div>
              </div>
              {spells.length > 0 ? (
                <div className="spell-cast-list">
                  {spells.map((spellName) => {
                    const castCount = spellCastCounts[classKey]?.[level]?.[spellName] ?? 0;
                    return (
                      <div className="spell-cast-row" key={`${classKey}-${level}-${spellName}`}>
                        <span className="resource-label">{spellName} ×{castCount}</span>
                        <div className="resource-buttons">
                          <button
                            className="ghost small"
                            disabled={remaining <= 0}
                            onClick={() => castSpell(classKey, level, max, spellName, remaining)}
                          >
                            Cast
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        <button className="ghost small" onClick={() => resetSpellClassRuntime(classKey, levels)}>
          Rest All
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          Path-Builder <span className="brand-sub">Pathfinder 1e smart sheet</span>
        </div>
        <div className="actions">
          <button onClick={() => setLeveling(true)}>⬆ Level Up</button>
          <button
            className="ghost"
            disabled={build.levels.length <= 1}
            onClick={() => setBuild((b) => levelDown(b))}
          >
            ↩ Undo Level
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="controls">
          <section className="panel">
            <h2>Build Editor</h2>
            <p className="hint">Edit the core build without diving into JSON like some kind of cave wizard.</p>
            <label className="field compact">
              <span>Name</span>
              <input
                type="text"
                value={build.name}
                onChange={(e) => setBuild((prev) => ({ ...prev, name: e.target.value || "Unnamed Hero" }))}
              />
            </label>
            <div className="editor-grid">
              {ABILITY_ORDER.map((ability) => (
                <label className="field compact" key={ability}>
                  <span>{ability.toUpperCase()}</span>
                  <input
                    type="number"
                    min={1}
                    value={build.baseAbilityScores[ability]}
                    onChange={(e) => updateBaseAbilityScore(ability, Number(e.target.value) || 1)}
                  />
                </label>
              ))}
            </div>
            <label className="field compact">
              <span>Manual carried weight (lb) <span className="muted">optional override</span></span>
              <input
                type="number"
                min={0}
                value={build.carriedWeight ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBuild((prev) => ({
                    ...prev,
                    carriedWeight: raw === "" ? undefined : Math.max(0, Number(raw) || 0),
                  }));
                }}
              />
            </label>
            <div className="editor-section-head">
              <h3>Race & Level Structure</h3>
              <button className="ghost small" onClick={addStructureLevel}>Add Level</button>
            </div>
            <label className="field compact">
              <span>Race</span>
              <select
                value={RACE_OPTIONS.find(([, race]) => race.name === build.race.name)?.[0] ?? "human"}
                onChange={(e) => updateRace(e.target.value)}
              >
                {RACE_OPTIONS.map(([key, race]) => (
                  <option key={key} value={key}>{race.name}</option>
                ))}
              </select>
            </label>
            <div className="editor-section-head">
              <h3>Feats, Skills & Structure by Level</h3>
            </div>
            <datalist id="feat-options">
              {featOptions.map((name) => <option key={name} value={name} />)}
            </datalist>
            <div className="item-list">
              {build.levels.map((level, levelIndex) => (
                <div className="item-card" key={`level-edit-${levelIndex}`}>
                  <div className="editor-section-head tight">
                    <h3>Level {levelIndex + 1} — {level.className}</h3>
                    <button
                      className="ghost small"
                      disabled={build.levels.length <= 1}
                      onClick={() => removeStructureLevel(levelIndex)}
                    >
                      Remove Level
                    </button>
                  </div>
                  <div className="editor-grid">
                    <label className="field compact">
                      <span>Class</span>
                      <select
                        value={level.className}
                        onChange={(e) => updateLevelField(levelIndex, "className", e.target.value)}
                      >
                        {CLASS_OPTIONS.map((option) => (
                          <option key={option.name} value={option.name}>{option.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field compact">
                      <span>HP roll</span>
                      <input
                        type="number"
                        min={1}
                        max={CLASS_OPTIONS.find((option) => option.name === level.className)?.hitDie ?? 20}
                        value={level.hitPointRoll}
                        onChange={(e) => updateLevelField(levelIndex, "hitPointRoll", Math.max(1, Number(e.target.value) || 1))}
                      />
                    </label>
                    <label className="field compact">
                      <span>Favored class</span>
                      <select
                        value={level.favoredClass ?? ""}
                        onChange={(e) => updateLevelField(levelIndex, "favoredClass", (e.target.value || undefined) as "hp" | "skill" | undefined)}
                      >
                        <option value="">None</option>
                        <option value="hp">HP</option>
                        <option value="skill">Skill</option>
                      </select>
                    </label>
                    <label className="field compact">
                      <span>Ability increase</span>
                      <select
                        value={level.abilityIncrease ?? ""}
                        onChange={(e) => updateLevelField(levelIndex, "abilityIncrease", (e.target.value || undefined) as AbilityKey | undefined)}
                      >
                        <option value="">None</option>
                        {ABILITY_ORDER.map((ability) => (
                          <option key={ability} value={ability}>{ability.toUpperCase()}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="subsection-title">Feats</div>
                  <div className="item-list compact-list">
                    {(level.feats ?? []).map((featName, featIndex) => (
                      <div className="inline-row" key={`feat-${levelIndex}-${featIndex}`}>
                        <input
                          className="inline-input"
                          type="text"
                          list="feat-options"
                          value={featName}
                          onChange={(e) => updateLevelFeatName(levelIndex, featIndex, e.target.value)}
                        />
                        <button className="ghost small" onClick={() => removeLevelFeat(levelIndex, featIndex)}>Remove</button>
                      </div>
                    ))}
                    <div className="item-actions left">
                      <button className="ghost small" onClick={() => addLevelFeat(levelIndex)}>Add Feat</button>
                    </div>
                  </div>
                  <div className="subsection-title">Skill Ranks</div>
                  <div className="skill-rank-grid">
                    {SKILL_DEFINITIONS.slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((skill) => (
                        <label className="field compact skill-rank-field" key={`rank-${levelIndex}-${skill.key}`}>
                          <span>{SKILL_NAME.get(skill.key) ?? skill.key}</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={level.skillRanks?.[skill.key] ?? 0}
                            onChange={(e) => updateLevelSkillRank(levelIndex, skill.key, Math.max(0, Number(e.target.value) || 0))}
                          />
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            {sheet.spellcasting.length > 0 ? (
              <>
                <div className="editor-section-head">
                  <h3>Spellcasting Build Setup</h3>
                </div>
                <p className="hint">Manage prepared/known spells, capacity, and legality in one place instead of playing note-card necromancy.</p>
                <datalist id="spell-options">
                  {SPELL_OPTIONS.map((spell) => <option key={spell.id} value={spell.name} />)}
                </datalist>
                <div className="item-list">
                  {sheet.spellcasting.map((caster) => {
                    const classKey = caster.className.toLowerCase();
                    const mode = caster.castingType === "prepared" ? "prepared" : "known";
                    const selections = mode === "prepared" ? caster.selectedPreparedSpells : caster.selectedKnownSpells;
                    const levels = Object.keys(caster.selectionDiagnostics)
                      .map(Number)
                      .sort((a, b) => a - b);
                    const invalidLevels = levels.filter((level) => {
                      const diag = caster.selectionDiagnostics[level];
                      return !!diag && (
                        diag.overCapacity ||
                        diag.unknownSpells.length > 0 ||
                        diag.offListSpells.length > 0 ||
                        diag.wrongLevelSpells.length > 0
                      );
                    });
                    return (
                      <div className="item-card" key={`spells-${classKey}`}>
                        <div className="editor-section-head tight">
                          <h3>{caster.className} {mode === "prepared" ? "Prepared Spells" : "Known Spells"}</h3>
                          <button className="ghost small" onClick={() => resetSpellSelectionsForClass(classKey, mode, levels)}>
                            Clear All
                          </button>
                        </div>
                        <div className="spell-class-summary">
                          <span className="resource-label">Caster level {caster.casterLevel}</span>
                          <span className="resource-label">Concentration +{caster.concentration.total}</span>
                          {invalidLevels.length > 0 ? (
                            <span className="warn-pill">Needs fixes on L{invalidLevels.join(", L")}</span>
                          ) : (
                            <span className="ok-pill">Selections look legal</span>
                          )}
                        </div>
                        {levels.map((level) => {
                          const current = selections[level] ?? [];
                          const diag = caster.selectionDiagnostics[level];
                          if (!diag) return null;
                          const canAdd = current.length < diag.capacity;
                          const quickPicks = diag.availableSpellNames.filter((name) => !current.includes(name)).slice(0, 6);
                          return (
                            <div className="spell-level-block" key={`spell-edit-${classKey}-${level}`}>
                              <div className="editor-section-head tight">
                                <div className="subsection-title level-title">
                                  Level {level} <span className="muted">{current.length}/{diag.capacity} selected</span>
                                </div>
                                <div className="resource-buttons">
                                  <button
                                    className="ghost small"
                                    disabled={!canAdd}
                                    onClick={() => addSpellSelection(classKey, mode, level)}
                                  >
                                    Add Blank
                                  </button>
                                  <button
                                    className="ghost small"
                                    disabled={current.length === 0}
                                    onClick={() => resetSpellSelectionsForLevel(classKey, mode, level)}
                                  >
                                    Clear Level
                                  </button>
                                </div>
                              </div>
                              {diag.overCapacity ? <p className="hint warn-text">Over capacity: {current.length}/{diag.capacity} selected.</p> : null}
                              {diag.unknownSpells.length > 0 ? <p className="hint warn-text">Unknown: {diag.unknownSpells.join(", ")}</p> : null}
                              {diag.offListSpells.length > 0 ? <p className="hint warn-text">Not on {caster.className} list: {diag.offListSpells.join(", ")}</p> : null}
                              {diag.wrongLevelSpells.length > 0 ? (
                                <p className="hint warn-text">
                                  Wrong level: {diag.wrongLevelSpells.map((s) => `${s.name} (actual ${s.actualLevel})`).join(", ")}
                                </p>
                              ) : null}
                              <div className="item-list compact-list">
                                {current.map((spellName, index) => (
                                  <div className="inline-row" key={`spell-${classKey}-${level}-${index}`}>
                                    <input
                                      className="inline-input"
                                      type="text"
                                      list="spell-options"
                                      value={spellName}
                                      onChange={(e) => updateSpellSelectionName(classKey, mode, level, index, e.target.value)}
                                    />
                                    <button className="ghost small" onClick={() => removeSpellSelection(classKey, mode, level, index)}>
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                              {quickPicks.length > 0 ? (
                                <div className="quick-picks">
                                  {quickPicks.map((spellName) => (
                                    <button
                                      key={`${classKey}-${level}-${spellName}`}
                                      className="ghost small"
                                      disabled={!canAdd}
                                      onClick={() => appendSpellSelection(classKey, mode, level, spellName)}
                                    >
                                      + {spellName}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              {diag.availableSpellNames.length > 0 ? (
                                <div className="hint">Registry options: {diag.availableSpellNames.join(", ")}</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
            <div className="editor-section-head">
              <h3>Weapons</h3>
              <button className="ghost small" onClick={addWeapon}>Add Weapon</button>
            </div>
            <div className="item-list">
              {(build.weapons ?? []).map((weapon, index) => (
                <div className="item-card" key={`weapon-${index}`}>
                  <div className="editor-grid">
                    <label className="field compact">
                      <span>Name</span>
                      <input type="text" value={weapon.name} onChange={(e) => updateWeapon(index, { name: e.target.value })} />
                    </label>
                    <label className="field compact">
                      <span>Category</span>
                      <select value={weapon.category} onChange={(e) => updateWeapon(index, { category: e.target.value as "melee" | "ranged" })}>
                        <option value="melee">Melee</option>
                        <option value="ranged">Ranged</option>
                      </select>
                    </label>
                    <label className="field compact">
                      <span>Damage dice</span>
                      <input type="text" value={weapon.damageDice} onChange={(e) => updateWeapon(index, { damageDice: e.target.value || "1d6" })} />
                    </label>
                    <label className="field compact">
                      <span>Handedness</span>
                      <select value={weapon.handedness ?? "one"} onChange={(e) => updateWeapon(index, { handedness: e.target.value as "one" | "two" | "off" | "light" })}>
                        <option value="one">One-Handed</option>
                        <option value="two">Two-Handed</option>
                        <option value="off">Off-Hand</option>
                        <option value="light">Light</option>
                      </select>
                    </label>
                    <label className="field compact">
                      <span>Crit range</span>
                      <input type="number" min={18} max={20} value={weapon.critRange ?? 20} onChange={(e) => updateWeapon(index, { critRange: Math.max(18, Math.min(20, Number(e.target.value) || 20)) })} />
                    </label>
                    <label className="field compact">
                      <span>Crit multiplier</span>
                      <input type="number" min={2} max={5} value={weapon.critMultiplier ?? 2} onChange={(e) => updateWeapon(index, { critMultiplier: Math.max(2, Math.min(5, Number(e.target.value) || 2)) })} />
                    </label>
                  </div>
                  <div className="item-actions">
                    <button className="ghost small" onClick={() => removeWeapon(index)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="editor-section-head">
              <h3>Equipment</h3>
              <button className="ghost small" onClick={addEquipment}>Add Item</button>
            </div>
            <div className="item-list">
              {(build.equipment ?? []).map((item, index) => {
                const armor: EquipmentArmorEditorState = item.armor
                  ? {
                      category: item.armor.category ?? "light",
                      maxDexBonus: item.armor.maxDexBonus,
                      checkPenalty: item.armor.checkPenalty,
                      speedPenalty: item.armor.speedPenalty,
                    }
                  : { category: "none", maxDexBonus: undefined, checkPenalty: undefined, speedPenalty: undefined };
                return (
                  <div className="item-card" key={`equipment-${index}`}>
                    <div className="editor-grid">
                      <label className="field compact">
                        <span>Name</span>
                        <input type="text" value={item.name} onChange={(e) => updateEquipment(index, { name: e.target.value })} />
                      </label>
                      <label className="field compact">
                        <span>Quantity</span>
                        <input type="number" min={0} value={item.quantity ?? 1} onChange={(e) => updateEquipment(index, { quantity: Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                      <label className="field compact">
                        <span>Weight (lb)</span>
                        <input type="number" min={0} value={item.weight ?? 0} onChange={(e) => updateEquipment(index, { weight: Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                      <label className="field compact">
                        <span>Cost (gp)</span>
                        <input type="number" min={0} value={item.costGp ?? 0} onChange={(e) => updateEquipment(index, { costGp: Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                      <label className="field compact">
                        <span>Armor category</span>
                        <select value={armor.category ?? "none"} onChange={(e) => updateEquipmentArmor(index, { ...armor, category: e.target.value as "none" | "light" | "medium" | "heavy" })}>
                          <option value="none">None</option>
                          <option value="light">Light</option>
                          <option value="medium">Medium</option>
                          <option value="heavy">Heavy</option>
                        </select>
                      </label>
                      <label className="field compact checkbox-field">
                        <span>Equipped</span>
                        <input type="checkbox" checked={!!item.equipped} onChange={(e) => updateEquipment(index, { equipped: e.target.checked })} />
                      </label>
                      <label className="field compact">
                        <span>Max Dex</span>
                        <input type="number" value={armor.maxDexBonus ?? ""} onChange={(e) => updateEquipmentArmor(index, { ...armor, maxDexBonus: e.target.value === "" ? undefined : Number(e.target.value) })} />
                      </label>
                      <label className="field compact">
                        <span>Armor check penalty</span>
                        <input type="number" value={armor.checkPenalty ?? ""} onChange={(e) => updateEquipmentArmor(index, { ...armor, checkPenalty: e.target.value === "" ? undefined : Number(e.target.value) })} />
                      </label>
                      <label className="field compact">
                        <span>Speed penalty</span>
                        <input type="number" min={0} value={armor.speedPenalty ?? ""} onChange={(e) => updateEquipmentArmor(index, { ...armor, speedPenalty: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                    </div>
                    <div className="item-actions">
                      <button className="ghost small" onClick={() => removeEquipment(index)}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2>Abilities, Buffs &amp; Auras</h2>
            <p className="hint">
              Toggle a granted class ability, a spell buff, or an aura and watch the
              sheet update live. Same modifier pipeline, less spaghetti.
            </p>
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
                      onChange={(e) =>
                        setActiveBuffs((prev) => ({ ...prev, [feature.id]: e.target.checked }))
                      }
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
            {activatableConflicts.length > 0 ? (
              <p className="hint warn-text">Conflicting modes were selected; only one per group applies.</p>
            ) : null}
            <div className="mode-group">
              <div className="mode-title">conditions</div>
              <label className="buff">
                <input
                  type="checkbox"
                  checked={fatigued}
                  onChange={(e) => setFatigued(e.target.checked)}
                />
                <span>
                  <strong>Fatigued</strong>
                  <span className="buff-desc">Blocks Rage and can suppress other abilities later.</span>
                </span>
              </label>
            </div>
            {BUFFS.map((buff) => (
              <label className="buff" key={buff.id}>
                <input
                  type="checkbox"
                  checked={!!activeBuffs[buff.id]}
                  onChange={(e) =>
                    setActiveBuffs((prev) => ({ ...prev, [buff.id]: e.target.checked }))
                  }
                />
                <span>
                  <strong>{buff.name}</strong>
                  <span className="buff-desc">{buff.description}</span>
                </span>
              </label>
            ))}
          </section>

          <section className="panel">
            <h2>Character Saves</h2>
            <p className="hint">Current build autosaves. Slots let you keep multiple characters/build states around.</p>
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

          {sheet.spellcasting.length > 0 ? (
            <section className="panel">
              <h2>Spell Slots</h2>
              <p className="hint">Burn slots by level during play. Same runtime brain, less paper goblinry.</p>
              {sheet.spellcasting.map((caster) => spellSlotControls(caster))}
            </section>
          ) : null}

          {errors.length > 0 ? (
            <section className="panel errors">
              <h2>Validation</h2>
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="panel ok">
              <h2>Validation</h2>
              <p>No issues — this build is legal. </p>
            </section>
          )}
        </aside>

        <main className="main">
          <Sheet sheet={sheet} />
        </main>
      </div>

      {leveling ? (
        <LevelUpModal
          build={build}
          onConfirm={confirmLevelUp}
          onClose={() => setLeveling(false)}
        />
      ) : null}
    </div>
  );
}
