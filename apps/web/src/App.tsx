import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  activatableResourceMax,
  applyLevelUp,
  buildCharacter,
  collectActivatableEffects,
  computeSheet,
  deriveHealthStatus,
  getSpellEffectByName,
  groupActivatables,
  levelDown,
  listFeats,
  resolveActivatableSelections,
  SKILL_DEFINITIONS,
  spellEffectResourceMax,
  equipmentWeaponTemplate,
  validateBuild,
  normalizeAmmoType,
  applyCampaignRulesToWeapon,
  type AbilityKey,
  type FirearmRulesMode,
  type ActivationContext,
  type CharacterBuild,
  type ArchetypeDefinitionLike,
  type LevelUpSelection,
  type MagicItemDefinition,
  type Modifier,
  type SkillKey,
  type SpellEffectRuntimeContext,
} from "@mathfinder/rules-engine";
import { buildRuntimeBuffs, initialBuild } from "./data";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_ARCHETYPES_BY_CLASS,
  RUNTIME_ARMOR,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_CLASS_OPTIONS,
  RUNTIME_CLASSES,
  RUNTIME_BUILD_GUIDES,
  RUNTIME_DOMAINS,
  RUNTIME_FEATS,
  RUNTIME_MAGIC_ITEMS,
  RUNTIME_MUNDANE_EQUIPMENT,
  RUNTIME_RACE_OPTIONS,
  RUNTIME_RACES,
  RUNTIME_SCHOOLS,
  RUNTIME_SPELL_OPTIONS,
  RUNTIME_SPELLS,
  RUNTIME_WEAPONS,
  equipmentMagicItemTemplate,
  getRuntimeMagicItem,
} from "./content";
import { addCoinPurseValue, spendCoinPurse, summarizeWealth } from "./wealth";
import type {
  RuntimeArmorDefinition,
  RuntimeMundaneEquipmentDefinition,
} from "./content";
import {
  consumeAmmoFromEquipment,
  consumeSpellComponentFromEquipment,
  createAmmoStack,
  restoreAmmoToEquipment,
} from "./equipmentTools";
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
import {
  buildSuggestions,
  type BuildSuggestionBundle,
  type LevelPlannerSuggestions,
} from "./buildSuggestions";
import type { RuntimeProfile } from "./runtimeInsights";
import { normalizeFeatListLength, plannedFeatSlotsForLevel } from "./featSlots";
import { plannerRollbackCount, type PlannerExpansion } from "./plannerState";
import {
  getCharacter,
  runtimeStorageKey,
  saveCharacter,
} from "./features/characters/characterRepository";

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
const EMPTY_PLANNER_SUGGESTIONS: LevelPlannerSuggestions = {
  guideChoices: [],
  classChoices: [],
  featChoices: [],
  featChoicesBySlot: [],
  favoredClassChoices: [],
  abilityChoices: [],
  notes: [],
};
const EMPTY_SUGGESTION_BUNDLE: BuildSuggestionBundle = {
  planner: Array.from({ length: 20 }, () => EMPTY_PLANNER_SUGGESTIONS),
  currentLevelSkills: [],
  currentLevelSkillNotes: [],
  spellChoices: {},
};
const CLASS_OPTIONS = RUNTIME_CLASS_OPTIONS;
const RACE_OPTIONS = RUNTIME_RACE_OPTIONS;
const WEAPON_OPTIONS = RUNTIME_WEAPONS;
const MAGIC_ITEM_OPTIONS = RUNTIME_MAGIC_ITEMS;
const ARMOR_OPTIONS = RUNTIME_ARMOR;
const MUNDANE_EQUIPMENT_OPTIONS = RUNTIME_MUNDANE_EQUIPMENT;
const RUNTIME_STORAGE_KEY = "mathfinder:web-runtime:v1";
const VALIDATION_DEBOUNCE_MS = 200;
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
const CURRENT_BUILD_STORAGE_KEY = "mathfinder:web-build:v1";
const CURRENT_LEVEL_STORAGE_KEY = "mathfinder:web-current-level:v1";
const BUILD_SLOTS_STORAGE_KEY = "mathfinder:web-build-slots:v1";
const HP_DAMAGE_RESOURCE_ID = "hp-damage";
const TEMP_HP_RESOURCE_ID = "temp-hp";
const NONLETHAL_DAMAGE_RESOURCE_ID = "nonlethal-damage";
const STABLE_FLAG_ID = "stable";

interface SavedBuildSlot {
  id: string;
  label: string;
  savedAt: string;
  build: CharacterBuild;
}

interface EquipmentArmorEditorState {
  category: "none" | "light" | "medium" | "heavy";
  acBonus?: number;
  maxDexBonus?: number;
  checkPenalty?: number;
  speedPenalty?: number;
}

interface EquipmentShieldEditorState {
  enabled: boolean;
  acBonus?: number;
  checkPenalty?: number;
}

function preferredFlexibleAbility(build: CharacterBuild) {
  const ranked = (
    Object.entries(build.baseAbilityScores) as [AbilityKey, number][]
  ).sort(
    (a, b) =>
      b[1] - a[1] || ABILITY_ORDER.indexOf(a[0]) - ABILITY_ORDER.indexOf(b[0]),
  );
  return ranked[0]?.[0] ?? "str";
}

function effectiveRaceChoiceOptions(
  race: CharacterBuild["race"],
  alternateTraitIds: string[],
) {
  const selectedIds = new Set(alternateTraitIds.map((id) => id.toLowerCase()));
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

function materializeRaceChoice(
  race: CharacterBuild["race"],
  build: CharacterBuild,
  previousRace?: CharacterBuild["race"],
): CharacterBuild["race"] {
  const validAlternateTraits = (
    previousRace?.choiceSelection?.alternateTraits ?? []
  ).filter(
    (id, index, arr) =>
      arr.findIndex((entry) => entry.toLowerCase() === id.toLowerCase()) ===
        index &&
      (race.alternateTraits ?? []).some(
        (trait) => trait.id.toLowerCase() === id.toLowerCase(),
      ),
  );
  const choiceOptions = effectiveRaceChoiceOptions(race, validAlternateTraits);
  const allowedAbilities =
    choiceOptions.flexibleAbilityBonus?.abilities ?? ABILITY_ORDER;
  const preservedFlexibleAbility =
    previousRace?.choiceSelection?.flexibleAbility;
  const flexibleAbility =
    preservedFlexibleAbility &&
    allowedAbilities.includes(preservedFlexibleAbility)
      ? preservedFlexibleAbility
      : choiceOptions.flexibleAbilityBonus
        ? preferredFlexibleAbility(build)
        : undefined;
  const bonusFeatOptions = choiceOptions.bonusFeat?.featOptions;
  const preservedBonusFeat = previousRace?.choiceSelection?.bonusFeat?.trim();
  const bonusFeat =
    preservedBonusFeat &&
    (!bonusFeatOptions?.length ||
      bonusFeatOptions.some(
        (feat) => feat.toLowerCase() === preservedBonusFeat.toLowerCase(),
      ))
      ? preservedBonusFeat
      : undefined;
  return {
    ...race,
    choiceSelection: {
      alternateTraits: validAlternateTraits,
      flexibleAbility: choiceOptions.flexibleAbilityBonus
        ? flexibleAbility && allowedAbilities.includes(flexibleAbility)
          ? flexibleAbility
          : allowedAbilities[0]
        : undefined,
      bonusFeat,
    },
  };
}

function normalizeBuild(build: CharacterBuild): CharacterBuild {
  const normalizedRace = materializeRaceChoice(build.race, build, build.race);
  const normalizedArchetypes = Object.fromEntries(
    Object.entries(build.classArchetypes ?? {})
      .map(([classKey, archetypeIds]) => {
        const validIds = [
          ...new Set(
            (archetypeIds ?? [])
              .map((id) => id.trim().toLowerCase())
              .filter((id) => {
                const archetype = RUNTIME_ARCHETYPES[id];
                return (
                  !!archetype &&
                  archetype.baseClassName.toLowerCase() ===
                    classKey.toLowerCase()
                );
              }),
          ),
        ];
        return [classKey.toLowerCase(), validIds];
      })
      .filter(([, ids]) => (ids as string[]).length > 0),
  );
  return {
    ...build,
    race: normalizedRace,
    classArchetypes: normalizedArchetypes,
    equipment: build.equipment?.map((item) => {
      if (!item.itemTemplateId) {
        return {
          ...item,
          kind: item.kind ?? "mundane",
          ownership: item.ownership ?? "owned",
          carryState: item.carryState ?? (item.equipped ? "carried" : "stowed"),
          spellTriggerNames: (item.spellTriggerNames ?? [])
            .map((name) => name.trim())
            .filter(Boolean),
        };
      }
      const magicItem = getRuntimeMagicItem(item.itemTemplateId);
      if (!magicItem) {
        const armorItem = ARMOR_OPTIONS.find(
          (entry) => entry.id === item.itemTemplateId,
        );
        if (armorItem) {
          return armorItem.categoryNormalized === "shield"
            ? {
                ...item,
                kind: "mundane",
                ownership: item.ownership ?? "owned",
                spellTriggerNames: (item.spellTriggerNames ?? [])
                  .map((name) => name.trim())
                  .filter(Boolean),
                itemTemplateId: armorItem.id,
                name: armorItem.name,
                weight: armorItem.weightLb,
                costGp: armorItem.costGp,
                slot: "shield",
                armor: undefined,
                shield: {
                  acBonus: armorItem.armorBonus,
                  checkPenalty: armorItem.armorCheckPenalty,
                },
              }
            : {
                ...item,
                kind: "mundane",
                ownership: item.ownership ?? "owned",
                spellTriggerNames: (item.spellTriggerNames ?? [])
                  .map((name) => name.trim())
                  .filter(Boolean),
                itemTemplateId: armorItem.id,
                name: armorItem.name,
                weight: armorItem.weightLb,
                costGp: armorItem.costGp,
                slot: "armor",
                shield: undefined,
                armor: armorItem.categoryNormalized
                  ? {
                      category: armorItem.categoryNormalized,
                      acBonus: armorItem.armorBonus,
                      maxDexBonus: armorItem.maxDexBonus,
                      checkPenalty: armorItem.armorCheckPenalty,
                      speedPenalty:
                        typeof armorItem.speed30 === "number" &&
                        typeof armorItem.speed20 === "number"
                          ? armorItem.speed30 - armorItem.speed20
                          : undefined,
                    }
                  : undefined,
              };
        }
        const mundaneItem = MUNDANE_EQUIPMENT_OPTIONS.find(
          (entry) => entry.id === item.itemTemplateId,
        );
        return mundaneItem
          ? {
              ...item,
              kind: "mundane",
              ownership: item.ownership ?? "owned",
              spellTriggerNames: (item.spellTriggerNames ?? [])
                .map((name) => name.trim())
                .filter(Boolean),
              carryState:
                item.carryState ?? (item.equipped ? "carried" : "stowed"),
              itemTemplateId: mundaneItem.id,
              name: mundaneItem.name,
              weight: mundaneItem.weightLb,
              costGp: mundaneItem.costGp,
              armor: undefined,
              shield: undefined,
            }
          : { ...item, kind: item.kind ?? "mundane" };
      }
      const template = equipmentMagicItemTemplate(magicItem);
      return {
        ...item,
        kind: "magic",
        ownership: item.ownership ?? "owned",
        spellTriggerNames: (item.spellTriggerNames ?? [])
          .map((name) => name.trim())
          .filter(Boolean),
        itemTemplateId: template.itemTemplateId,
        name: template.name,
        weight: template.weight,
        costGp: template.costGp,
        slot: template.slot,
        modifiers: template.modifiers,
      };
    }),
  };
}

function loadCurrentBuild(characterId?: string): CharacterBuild {
  if (typeof window === "undefined") return initialBuild;
  try {
    const character = characterId
      ? getCharacter(window.localStorage, characterId)
      : undefined;
    if (character) {
      return syncTemplatedWeaponsToCampaignRules(
        normalizeBuild(character.build),
      );
    }
    const raw = window.localStorage.getItem(CURRENT_BUILD_STORAGE_KEY);
    if (!raw) throw new Error("empty");
    return syncTemplatedWeaponsToCampaignRules(
      normalizeBuild(JSON.parse(raw) as CharacterBuild),
    );
  } catch {
    return initialBuild;
  }
}

function equipmentSlotLimit(
  slot: Exclude<
    NonNullable<CharacterBuild["equipment"]>[number]["slot"],
    undefined
  >,
) {
  return slot === "ring" ? 2 : 1;
}

function defaultEquipmentState(
  entry: NonNullable<CharacterBuild["equipment"]>[number],
) {
  if (entry.ownership === "wishlist" || entry.carryState === "cached") {
    return { equipped: false, carryState: "cached" as const };
  }
  const shouldEquip =
    entry.slot != null
      ? entry.slot !== "slotless"
      : !!entry.armor || !!entry.shield || !!entry.weapon;
  return {
    equipped: shouldEquip,
    carryState: "carried" as const,
  };
}

function withDefaultEquipmentState(
  entry: NonNullable<CharacterBuild["equipment"]>[number],
) {
  return {
    ...defaultEquipmentState(entry),
    ownership: "owned" as const,
    ...entry,
  };
}

function isGenericUnspecializedEquipment(
  entry: NonNullable<CharacterBuild["equipment"]>[number],
) {
  return (
    !entry.itemTemplateId &&
    entry.slot == null &&
    !entry.armor &&
    !entry.shield &&
    !entry.weapon &&
    !entry.modifiers?.length
  );
}

function applyTemplateEquipmentState(
  previous: NonNullable<CharacterBuild["equipment"]>[number],
  next: NonNullable<CharacterBuild["equipment"]>[number],
) {
  return isGenericUnspecializedEquipment(previous)
    ? { ...next, ...defaultEquipmentState(next) }
    : next;
}

function sanitizeEquippedEquipment(
  equipment: NonNullable<CharacterBuild["equipment"]>,
  priorityIndex?: number,
) {
  const slotUsage = new Map<string, number[]>();
  const armorIndexes: number[] = [];
  const shieldIndexes: number[] = [];

  equipment.forEach((item, index) => {
    if (!item.equipped || item.carryState === "cached") return;
    if (item.slot) {
      const current = slotUsage.get(item.slot) ?? [];
      current.push(index);
      slotUsage.set(item.slot, current);
    }
    if (item.armor) armorIndexes.push(index);
    if (item.shield) shieldIndexes.push(index);
  });

  const indexesToUnequip = new Set<number>();
  const trimIndexes = (indexes: number[], limit: number) => {
    if (indexes.length <= limit) return;
    const prioritized =
      priorityIndex != null && indexes.includes(priorityIndex)
        ? [priorityIndex, ...indexes.filter((index) => index !== priorityIndex)]
        : indexes;
    prioritized.slice(limit).forEach((index) => indexesToUnequip.add(index));
  };

  for (const [slot, indexes] of slotUsage.entries()) {
    trimIndexes(
      indexes,
      equipmentSlotLimit(
        slot as Exclude<
          NonNullable<CharacterBuild["equipment"]>[number]["slot"],
          undefined
        >,
      ),
    );
  }
  trimIndexes(armorIndexes, 1);
  trimIndexes(shieldIndexes, 1);

  return equipment.map((item, index) => {
    const forcedUnequipped =
      indexesToUnequip.has(index) || item.carryState === "cached";
    return forcedUnequipped ? { ...item, equipped: false } : item;
  });
}

function withAmmoAutofill(build: CharacterBuild, ammoType: string | undefined) {
  if (!ammoType?.trim()) return build;
  const normalized = normalizeAmmoType(ammoType);
  const hasAmmoStack = (build.equipment ?? []).some(
    (item) => normalizeAmmoType(item.ammoType ?? item.name) === normalized,
  );
  if (hasAmmoStack) return build;
  return {
    ...build,
    equipment: [...(build.equipment ?? []), createAmmoStack(normalized)],
  };
}

function runtimeWeaponOptions(build: CharacterBuild) {
  return WEAPON_OPTIONS.map((weapon) =>
    applyCampaignRulesToWeapon(weapon, build.campaignRules),
  );
}

function syncTemplatedWeaponsToCampaignRules(
  build: CharacterBuild,
): CharacterBuild {
  const weaponById = new Map(
    runtimeWeaponOptions(build).map((weapon) => [weapon.id, weapon] as const),
  );
  return {
    ...build,
    weapons: build.weapons?.map((weapon) => {
      const templateId = weapon.weaponTemplateId;
      if (!templateId) return weapon;
      const template = weaponById.get(templateId);
      if (!template) return weapon;
      return {
        ...weapon,
        weaponTemplateId: template.id,
        name: template.name,
        category: template.category,
        proficiencyGroup: template.proficiencyGroup,
        damageDice: template.damageDice,
        handedness: template.handedness,
        critRange: template.critRange,
        critMultiplier: template.critMultiplier,
        rangeIncrementFeet: template.rangeIncrementFeet,
        damageTypes: template.damageTypes,
        specialTags: template.specialTags,
        ammoType: template.ammoType,
        loadedAmmoType: undefined,
        ammoPerAttack: template.ammoPerAttack,
        reloadType: template.reloadType,
        firearmCategory: template.firearmCategory,
        weaponTechnology: template.weaponTechnology,
        attackModifier: template.attackModifier,
        extraDamageDice: template.extraDamageDice,
        ammoNotes: template.ammoNotes,
        ordnanceProfile: template.ordnanceProfile,
        misfire: template.misfire,
        targetsTouchAcWithinFirstRangeIncrement:
          template.targetsTouchAcWithinFirstRangeIncrement,
        damageAbility: template.damageAbility,
      };
    }),
    equipment: build.equipment?.map((item) => {
      const templateId = item.itemTemplateId;
      if (!templateId || !item.weapon) return item;
      const template = weaponById.get(templateId);
      if (!template) return item;
      const weaponTemplate = equipmentWeaponTemplate(template);
      return {
        ...item,
        name: weaponTemplate.name,
        weight: weaponTemplate.weight,
        costGp: weaponTemplate.costGp,
        weapon: weaponTemplate.weapon,
      };
    }),
  };
}

function loadCurrentLevel(characterId?: string) {
  if (typeof window === "undefined") return initialBuild.levels.length;
  try {
    const character = characterId
      ? getCharacter(window.localStorage, characterId)
      : undefined;
    if (character) return character.currentLevel;
    const raw = window.localStorage.getItem(CURRENT_LEVEL_STORAGE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 1
      ? Math.floor(parsed)
      : initialBuild.levels.length;
  } catch {
    return initialBuild.levels.length;
  }
}

function loadBuildSlots(): SavedBuildSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BUILD_SLOTS_STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as SavedBuildSlot[];
    return Array.isArray(parsed)
      ? parsed.map((slot) => ({
          ...slot,
          build: syncTemplatedWeaponsToCampaignRules(
            normalizeBuild(slot.build),
          ),
        }))
      : [];
  } catch {
    return [];
  }
}

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
  const [build, setBuild] = useState<CharacterBuild>(() =>
    loadCurrentBuild(characterId),
  );
  const [currentLevel, setCurrentLevel] = useState(() =>
    loadCurrentLevel(characterId),
  );
  const deferredBuild = useDeferredValue(build);
  const [savedBuildSlots, setSavedBuildSlots] =
    useState<SavedBuildSlot[]>(loadBuildSlots);
  const persistedCharacterSnapshot = useRef(
    JSON.stringify({ build, currentLevel }),
  );
  const pendingPersistence = useRef({ build, currentLevel });
  const plannerExpansion = useRef<PlannerExpansion | null>(null);
  pendingPersistence.current = { build, currentLevel };
  const {
    activeBuffs,
    resourcesUsed,
    spellSlotUsage,
    spellCastCounts,
    ammoSpent,
    weaponAttackHistory,
    combatEventLog,
    fatigued,
    stable,
    resetAll: resetRuntimeState,
    setToggle,
    setExclusiveToggleGroup,
    setFlag,
    adjustResource,
    resetResource,
    adjustSpellSlot,
    castSpell: runtimeCastSpell,
    resetSpellClassRuntime,
    resetSpellSlotLevel,
    clearCombatEventLog,
    applyTrackedDamage,
    consumeSpellComponent: runtimeConsumeSpellComponent,
    resetAmmo: runtimeResetAmmo,
    recordWeaponAttack: runtimeRecordWeaponAttack,
    undoWeaponAttack: runtimeUndoWeaponAttack,
    setWeaponAttackOutcome,
    tagLatestWeaponAttackOutcome,
    setWeaponAttackNote,
    setLatestWeaponAttackNote,
    resetWeaponAttackHistory,
  } = useRuntimeState(
    characterId ? runtimeStorageKey(characterId) : RUNTIME_STORAGE_KEY,
  );
  const [leveling, setLeveling] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [mountedTabs, setMountedTabs] = useState({
    sheet: initialTab === "sheet",
    gear: initialTab === "gear",
    build: initialTab === "build",
  });
  const weaponOptions = useMemo(
    () => runtimeWeaponOptions(build),
    [build.campaignRules],
  );

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

  function saveNewBuildSlot() {
    const now = new Date().toISOString();
    const slot: SavedBuildSlot = {
      id: `${Date.now()}`,
      label:
        currentLevel === build.levels.length
          ? `${build.name} (L${currentLevel})`
          : `${build.name} (L${currentLevel}/${build.levels.length})`,
      savedAt: now,
      build,
    };
    setSavedBuildSlots((prev) => [slot, ...prev]);
  }

  function overwriteBuildSlot(slotId: string) {
    const now = new Date().toISOString();
    setSavedBuildSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              label:
                currentLevel === build.levels.length
                  ? `${build.name} (L${currentLevel})`
                  : `${build.name} (L${currentLevel}/${build.levels.length})`,
              savedAt: now,
              build,
            }
          : slot,
      ),
    );
  }

  function loadBuildSlot(slot: SavedBuildSlot) {
    const normalized = normalizeBuild(slot.build);
    setBuild(normalized);
    setCurrentLevel(normalized.levels.length);
    resetRuntimeState();
    setLeveling(false);
  }

  function loadBuildSlotById(slotId: string) {
    const slot = savedBuildSlots.find((entry) => entry.id === slotId);
    if (!slot) return;
    loadBuildSlot(slot);
  }

  function deleteBuildSlot(slotId: string) {
    setSavedBuildSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }

  function resetCurrentBuild() {
    setBuild(initialBuild);
    setCurrentLevel(initialBuild.levels.length);
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
    const nextRace = RUNTIME_RACES[raceKey];
    if (!nextRace) return;
    setBuild((prev) => ({
      ...prev,
      race: materializeRaceChoice(nextRace, prev, prev.race),
    }));
  }

  function updateRaceFlexibleAbility(value: AbilityKey) {
    setBuild((prev) => ({
      ...prev,
      race: {
        ...prev.race,
        choiceSelection: {
          ...(prev.race.choiceSelection ?? {}),
          flexibleAbility: value,
        },
      },
    }));
  }

  function updateRaceBonusFeat(value: string) {
    setBuild((prev) => ({
      ...prev,
      race: {
        ...prev.race,
        choiceSelection: {
          ...(prev.race.choiceSelection ?? {}),
          bonusFeat: value || undefined,
        },
      },
    }));
  }

  function toggleRaceAlternateTrait(traitId: string) {
    setBuild((prev) => {
      const current = new Set(
        (prev.race.choiceSelection?.alternateTraits ?? []).map((id) =>
          id.toLowerCase(),
        ),
      );
      const canonicalIds = new Map(
        (prev.race.alternateTraits ?? []).map((trait) => [
          trait.id.toLowerCase(),
          trait.id,
        ]),
      );
      const key = traitId.toLowerCase();
      if (current.has(key)) current.delete(key);
      else current.add(key);
      const nextAlternateTraits = [...current].map(
        (id) => canonicalIds.get(id) ?? id,
      );
      return {
        ...prev,
        race: materializeRaceChoice(prev.race, prev, {
          ...prev.race,
          choiceSelection: {
            ...(prev.race.choiceSelection ?? {}),
            alternateTraits: nextAlternateTraits,
          },
        }),
      };
    });
  }

  function updateFavoredClassName(value: string) {
    setBuild((prev) => ({ ...prev, favoredClassName: value || undefined }));
  }

  function updateFirearmRulesMode(value: FirearmRulesMode) {
    setBuild((prev) =>
      syncTemplatedWeaponsToCampaignRules({
        ...prev,
        campaignRules:
          value === "standard"
            ? undefined
            : { ...(prev.campaignRules ?? {}), firearmRules: value },
      }),
    );
  }

  function updateClassArchetypes(className: string, archetypeIds: string[]) {
    setBuild((prev) => {
      const classKey = className.toLowerCase();
      const validIds = [
        ...new Set(
          archetypeIds
            .map((id) => id.trim().toLowerCase())
            .filter((id) => {
              const archetype = RUNTIME_ARCHETYPES[id];
              return (
                !!archetype &&
                archetype.baseClassName.toLowerCase() === classKey
              );
            }),
        ),
      ];
      const nextClassArchetypes = { ...(prev.classArchetypes ?? {}) };
      if (validIds.length > 0) nextClassArchetypes[classKey] = validIds;
      else delete nextClassArchetypes[classKey];
      return { ...prev, classArchetypes: nextClassArchetypes };
    });
  }

  function updateCarriedWeight(raw: string) {
    setBuild((prev) => ({
      ...prev,
      carriedWeight: raw === "" ? undefined : Math.max(0, Number(raw) || 0),
    }));
  }

  function updateCoinPurse(
    denomination: "pp" | "gp" | "sp" | "cp",
    value: number,
  ) {
    setBuild((prev) => ({
      ...prev,
      coinPurse: {
        ...(prev.coinPurse ?? {}),
        [denomination]: Math.max(0, Math.floor(value)),
      },
    }));
  }

  function updateCoinWeightCountsTowardEncumbrance(enabled: boolean) {
    setBuild((prev) => ({
      ...prev,
      coinWeightCountsTowardEncumbrance: enabled,
    }));
  }

  function buyEquipment(index: number, quantity = 1) {
    setBuild((prev) => {
      const item = prev.equipment?.[index];
      if (!item) return prev;
      const count = Math.max(
        1,
        Math.min(item.quantity ?? 1, Math.floor(quantity)),
      );
      const nextCoinPurse = spendCoinPurse(
        prev.coinPurse,
        (item.costGp ?? 0) * count,
      );
      if (!nextCoinPurse) return prev;
      const equipment = [...(prev.equipment ?? [])];
      const entry = equipment[index];
      if (!entry) return prev;
      if ((entry.ownership ?? "owned") === "wishlist") {
        const remaining = Math.max(0, (entry.quantity ?? 1) - count);
        const ownedCopy = {
          ...entry,
          ownership: "owned" as const,
          quantity: count,
          equipped: true,
          carryState: "stowed" as const,
        };
        if (remaining > 0) equipment[index] = { ...entry, quantity: remaining };
        else equipment.splice(index, 1);
        equipment.unshift(ownedCopy);
      } else {
        equipment[index] = {
          ...entry,
          quantity: (entry.quantity ?? 1) + count,
        };
      }
      return { ...prev, coinPurse: nextCoinPurse, equipment };
    });
  }

  function sellEquipment(index: number, quantity = 1) {
    setBuild((prev) => {
      const item = prev.equipment?.[index];
      if (!item || (item.ownership ?? "owned") !== "owned") return prev;
      const count = Math.max(
        1,
        Math.min(item.quantity ?? 1, Math.floor(quantity)),
      );
      const equipment = [...(prev.equipment ?? [])];
      const remaining = Math.max(0, (item.quantity ?? 1) - count);
      if (remaining > 0) equipment[index] = { ...item, quantity: remaining };
      else equipment.splice(index, 1);
      return {
        ...prev,
        coinPurse: addCoinPurseValue(
          prev.coinPurse,
          ((item.costGp ?? 0) * count) / 2,
        ),
        equipment,
      };
    });
  }

  function castSpell(
    classKey: string,
    level: number,
    max: number,
    spellName: string,
    remaining: number,
  ) {
    const effect = getSpellEffectByName(spellName);
    const spellResourceMax = effect
      ? spellEffectResourceMax(effect, spellEffectContext)
      : undefined;
    runtimeCastSpell(
      classKey,
      level,
      max,
      spellName,
      remaining,
      spellResourceMax,
    );
    let consumedItems: Array<{ itemName: string; quantity: number }> = [];
    setBuild((prev) => {
      const equipment = prev.equipment ?? [];
      const next = consumeSpellComponentFromEquipment(equipment, spellName);
      consumedItems = next.consumedItems;
      return next.consumedItems.length > 0
        ? { ...prev, equipment: next.equipment }
        : prev;
    });
    for (const consumed of consumedItems) {
      runtimeConsumeSpellComponent(
        spellName,
        consumed.itemName,
        consumed.quantity,
        consumedItems.length > 1 ? "multi-item spell trigger" : undefined,
      );
    }
  }

  function setSheetWeaponLoadedAmmo(
    sourceKind: "build" | "equipment" | "race" | undefined,
    sourceIndex: number | undefined,
    loadedAmmoType?: string,
  ) {
    if (sourceKind === "race" || sourceIndex == null) return;
    setBuild((prev) => {
      if (sourceKind === "build") {
        const weapons = [...(prev.weapons ?? [])];
        const weapon = weapons[sourceIndex];
        if (!weapon) return prev;
        weapons[sourceIndex] = { ...weapon, loadedAmmoType };
        return { ...prev, weapons };
      }
      const equipment = [...(prev.equipment ?? [])];
      const item = equipment[sourceIndex];
      if (!item?.weapon) return prev;
      equipment[sourceIndex] = {
        ...item,
        weapon: { ...item.weapon, loadedAmmoType },
      };
      return { ...prev, equipment };
    });
  }

  function recordWeaponAttack(
    weaponKey: string,
    weaponName: string,
    ammoType?: string,
    ammoSpentForAttack?: number,
    attackNote?: string,
    ammoEntries?: Array<{ ammoType: string; amount: number }>,
  ) {
    const requestedEntries = (ammoEntries ?? [])
      .filter((entry) => entry.amount > 0 && entry.ammoType?.trim())
      .map((entry) => ({ ...entry, amount: Math.max(0, entry.amount) }));
    const fallbackEntries =
      requestedEntries.length > 0
        ? requestedEntries
        : ammoType && (ammoSpentForAttack ?? 0) > 0
          ? [{ ammoType, amount: Math.max(0, ammoSpentForAttack ?? 0) }]
          : [];
    let nextEquipment = build.equipment ?? [];
    const consumedEntries = fallbackEntries.map((entry) => {
      const next = consumeAmmoFromEquipment(
        nextEquipment,
        entry.ammoType,
        entry.amount,
      );
      nextEquipment = next.equipment;
      return { ammoType: entry.ammoType, amount: next.consumed };
    });
    if (consumedEntries.some((entry) => entry.amount > 0)) {
      setBuild((prev) => ({ ...prev, equipment: nextEquipment }));
    }
    runtimeRecordWeaponAttack(
      weaponKey,
      weaponName,
      consumedEntries[0]?.ammoType ?? ammoType,
      consumedEntries[0]?.amount ?? ammoSpentForAttack,
      consumedEntries,
    );
    if (attackNote?.trim()) {
      setLatestWeaponAttackNote(weaponKey, attackNote.trim());
    }
  }

  function undoWeaponAttack(weaponKey: string, weaponName: string) {
    const attacks = weaponAttackHistory[weaponKey] ?? [];
    const last = attacks[attacks.length - 1];
    if (
      (last?.ammoEntries ?? []).some(
        (entry) => (ammoSpent[entry.ammoType] ?? 0) > 0,
      )
    ) {
      setBuild((prev) => ({
        ...prev,
        equipment: (last?.ammoEntries ?? []).reduce(
          (equipment, entry) =>
            restoreAmmoToEquipment(equipment, entry.ammoType, entry.amount),
          prev.equipment ?? [],
        ),
      }));
    }
    runtimeUndoWeaponAttack(weaponKey, weaponName);
  }

  function resetAmmo(ammoType?: string) {
    if (!ammoType?.trim()) {
      const ammoRestores = ammoSpent;
      setBuild((prev) => ({
        ...prev,
        equipment: Object.entries(ammoRestores).reduce(
          (equipment, [type, amount]) =>
            restoreAmmoToEquipment(equipment, type, amount),
          prev.equipment ?? [],
        ),
      }));
      runtimeResetAmmo();
      return;
    }
    const normalized = normalizeAmmoType(ammoType);
    const restoreAmount = ammoSpent[normalized] ?? 0;
    if (restoreAmount > 0) {
      setBuild((prev) => ({
        ...prev,
        equipment: restoreAmmoToEquipment(
          prev.equipment ?? [],
          normalized,
          restoreAmount,
        ),
      }));
    }
    runtimeResetAmmo(normalized);
  }

  function updateLevelField<K extends keyof CharacterBuild["levels"][number]>(
    levelIndex: number,
    key: K,
    value: CharacterBuild["levels"][number][K],
  ) {
    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.map((level, i) =>
        i === levelIndex ? { ...level, [key]: value } : level,
      ),
    }));
  }

  function makeDefaultLevelEntry(
    className?: string,
  ): CharacterBuild["levels"][number] {
    const resolvedClassName =
      className ??
      build.levels[build.levels.length - 1]?.className ??
      CLASS_OPTIONS[0]?.name ??
      "Fighter";
    const classKey = Object.keys(RUNTIME_CLASSES).find(
      (key) =>
        (RUNTIME_CLASSES[key]?.name?.toLowerCase?.() ?? "") ===
        resolvedClassName.toLowerCase(),
    );
    const hitDie = classKey ? (RUNTIME_CLASSES[classKey]?.hitDie ?? 8) : 8;
    return {
      className: resolvedClassName,
      hitPointRoll: Math.max(1, Math.ceil(hitDie / 2)),
      skillRanks: {},
      modifiers: [],
    };
  }

  function buildWithLevelCount(build: CharacterBuild, count: number) {
    const target = Math.max(1, Math.min(20, count));
    if (build.levels.length === target) return build;
    if (build.levels.length > target) {
      return { ...build, levels: build.levels.slice(0, target) };
    }
    const nextLevels = [...build.levels];
    while (nextLevels.length < target) {
      const lastClassName =
        nextLevels[nextLevels.length - 1]?.className ??
        build.levels[build.levels.length - 1]?.className;
      nextLevels.push(makeDefaultLevelEntry(lastClassName));
    }
    return { ...build, levels: nextLevels };
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

  function addStructureLevel() {
    setBuild((prev) => ({
      ...prev,
      levels: [...prev.levels, makeDefaultLevelEntry()],
    }));
  }

  function ensureLevelCount(count: number) {
    setBuild((prev) => buildWithLevelCount(prev, count));
  }

  function addWeapon() {
    setBuild((prev) => ({
      ...prev,
      weapons: [
        ...(prev.weapons ?? []),
        {
          name: "New Weapon",
          weaponTemplateId: undefined,
          category: "melee",
          proficiencyGroup: "simple",
          damageDice: "1d6",
          handedness: "one",
          critMultiplier: 2,
          critRange: 20,
        },
      ],
    }));
  }

  function updateWeapon(
    index: number,
    patch: Partial<NonNullable<CharacterBuild["weapons"]>[number]>,
  ) {
    setBuild((prev) => {
      const nextBuild = {
        ...prev,
        weapons: (prev.weapons ?? []).map((weapon, i) => {
          if (i !== index) return weapon;
          const next = { ...weapon, ...patch };
          const changedTemplateFields = [
            "name",
            "category",
            "proficiencyGroup",
            "damageDice",
            "handedness",
            "critRange",
            "critMultiplier",
            "rangeIncrementFeet",
            "damageTypes",
            "specialTags",
            "ammoType",
            "loadedAmmoType",
            "ammoPerAttack",
            "reloadType",
            "firearmCategory",
            "weaponTechnology",
            "attackModifier",
            "extraDamageDice",
            "ammoNotes",
            "ordnanceProfile",
            "misfire",
            "targetsTouchAcWithinFirstRangeIncrement",
            "damageAbility",
          ].some((key) => key in patch);
          if (changedTemplateFields && !("weaponTemplateId" in patch)) {
            next.weaponTemplateId = undefined;
          }
          return next;
        }),
      };
      return withAmmoAutofill(nextBuild, patch.ammoType);
    });
  }

  function applyWeaponTemplate(index: number, weaponId: string) {
    const template = weaponOptions.find((weapon) => weapon.id === weaponId);
    if (!template) return;
    updateWeapon(index, {
      weaponTemplateId: template.id,
      name: template.name,
      category: template.category,
      proficiencyGroup: template.proficiencyGroup,
      damageDice: template.damageDice,
      handedness: template.handedness,
      critRange: template.critRange,
      critMultiplier: template.critMultiplier,
      rangeIncrementFeet: template.rangeIncrementFeet,
      damageTypes: template.damageTypes,
      specialTags: template.specialTags,
      ammoType: template.ammoType,
      loadedAmmoType: undefined,
      ammoPerAttack: template.ammoPerAttack,
      reloadType: template.reloadType,
      firearmCategory: template.firearmCategory,
      weaponTechnology: template.weaponTechnology,
      attackModifier: template.attackModifier,
      extraDamageDice: template.extraDamageDice,
      ammoNotes: template.ammoNotes,
      ordnanceProfile: template.ordnanceProfile,
      misfire: template.misfire,
      targetsTouchAcWithinFirstRangeIncrement:
        template.targetsTouchAcWithinFirstRangeIncrement,
      damageAbility: template.damageAbility,
    });
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
        withDefaultEquipmentState({
          kind: "mundane",
          itemTemplateId: undefined,
          name: "New Item",
          quantity: 1,
          weight: 0,
          costGp: 0,
        }),
        ...(prev.equipment ?? []),
      ],
    }));
  }

  function addMagicItem() {
    setBuild((prev) => ({
      ...prev,
      equipment: [
        withDefaultEquipmentState({
          kind: "magic",
          itemTemplateId: undefined,
          name: "New Magic Item",
          quantity: 1,
          weight: 0,
          costGp: 0,
        }),
        ...(prev.equipment ?? []),
      ],
    }));
  }

  function addEquipmentEntry(
    entry: NonNullable<CharacterBuild["equipment"]>[number],
  ) {
    setBuild((prev) => ({
      ...prev,
      equipment: [withDefaultEquipmentState(entry), ...(prev.equipment ?? [])],
    }));
  }

  function applyMagicItemDefinition(index: number, item: MagicItemDefinition) {
    const template = equipmentMagicItemTemplate(item);
    setBuild((prev) => {
      const nextEquipment: NonNullable<CharacterBuild["equipment"]> = (
        prev.equipment ?? []
      ).map((entry, i) => {
        if (i !== index) return entry;
        const nextEntry: NonNullable<CharacterBuild["equipment"]>[number] = {
          ...entry,
          kind: "magic",
          carryState:
            entry.carryState ?? (entry.equipped ? "carried" : "stowed"),
          itemTemplateId: template.itemTemplateId,
          name: template.name,
          weight: template.weight,
          costGp: template.costGp,
          slot: template.slot,
          modifiers: template.modifiers,
          armor: undefined,
          shield: undefined,
          weapon: undefined,
        };
        return applyTemplateEquipmentState(entry, nextEntry);
      });
      return {
        ...prev,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function applyMagicItemTemplate(index: number, itemId: string) {
    const item = MAGIC_ITEM_OPTIONS.find((option) => option.id === itemId);
    if (!item) return;
    applyMagicItemDefinition(index, item);
  }

  function applyEquipmentCatalogTemplate(
    index: number,
    item: RuntimeMundaneEquipmentDefinition | RuntimeArmorDefinition,
  ) {
    setBuild((prev) => {
      const nextEquipment: NonNullable<CharacterBuild["equipment"]> = (
        prev.equipment ?? []
      ).map((entry, i) => {
        if (i !== index) return entry;
        const nextEntry: NonNullable<CharacterBuild["equipment"]>[number] =
          "categoryNormalized" in item
            ? item.categoryNormalized === "shield"
              ? {
                  ...entry,
                  kind: "mundane",
                  carryState:
                    entry.carryState ?? (entry.equipped ? "carried" : "stowed"),
                  itemTemplateId: item.id,
                  name: item.name,
                  weight: item.weightLb,
                  costGp: item.costGp,
                  slot: "shield" as const,
                  modifiers: undefined,
                  armor: undefined,
                  shield: {
                    acBonus: item.armorBonus,
                    checkPenalty: item.armorCheckPenalty,
                  },
                  weapon: undefined,
                }
              : {
                  ...entry,
                  kind: "mundane",
                  itemTemplateId: item.id,
                  name: item.name,
                  weight: item.weightLb,
                  costGp: item.costGp,
                  slot: "armor" as const,
                  modifiers: undefined,
                  armor: item.categoryNormalized
                    ? {
                        category: item.categoryNormalized,
                        acBonus: item.armorBonus,
                        maxDexBonus: item.maxDexBonus,
                        checkPenalty: item.armorCheckPenalty,
                        speedPenalty:
                          typeof item.speed30 === "number" &&
                          typeof item.speed20 === "number"
                            ? item.speed30 - item.speed20
                            : undefined,
                      }
                    : undefined,
                  shield: undefined,
                  weapon: undefined,
                }
            : {
                ...entry,
                kind: "mundane",
                itemTemplateId: item.id,
                name: item.name,
                weight: item.weightLb,
                costGp: item.costGp,
                slot: undefined,
                modifiers: undefined,
                armor: undefined,
                shield: undefined,
                weapon: undefined,
              };
        return applyTemplateEquipmentState(entry, nextEntry);
      });
      return {
        ...prev,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function applyMundaneEquipmentTemplate(index: number, itemId: string) {
    const item = MUNDANE_EQUIPMENT_OPTIONS.find(
      (option) => option.id === itemId,
    );
    if (!item) return;
    applyEquipmentCatalogTemplate(index, item);
  }

  function addMagicItemFromTemplate(itemId: string) {
    const item = MAGIC_ITEM_OPTIONS.find((option) => option.id === itemId);
    if (!item) return;
    const template = equipmentMagicItemTemplate(item);
    addEquipmentEntry({
      kind: "magic",
      itemTemplateId: template.itemTemplateId,
      name: template.name,
      quantity: 1,
      weight: template.weight,
      costGp: template.costGp,
      slot: template.slot,
      modifiers: template.modifiers,
    });
  }

  function addEquipmentFromTemplate(itemId: string) {
    const item = MUNDANE_EQUIPMENT_OPTIONS.find(
      (option) => option.id === itemId,
    );
    if (!item) return;
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: item.id,
      name: item.name,
      quantity: 1,
      weight: item.weightLb,
      costGp: item.costGp,
    });
  }

  function addArmorFromTemplate(itemId: string) {
    const item = ARMOR_OPTIONS.find(
      (option) =>
        option.id === itemId && option.categoryNormalized !== "shield",
    );
    if (!item) return;
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: item.id,
      name: item.name,
      quantity: 1,
      weight: item.weightLb,
      costGp: item.costGp,
      slot: "armor",
      armor:
        item.categoryNormalized && item.categoryNormalized !== "shield"
          ? {
              category: item.categoryNormalized,
              acBonus: item.armorBonus,
              maxDexBonus: item.maxDexBonus,
              checkPenalty: item.armorCheckPenalty,
              speedPenalty:
                typeof item.speed30 === "number" &&
                typeof item.speed20 === "number"
                  ? item.speed30 - item.speed20
                  : undefined,
            }
          : undefined,
    });
  }

  function addShieldFromTemplate(itemId: string) {
    const item = ARMOR_OPTIONS.find(
      (option) =>
        option.id === itemId && option.categoryNormalized === "shield",
    );
    if (!item) return;
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: item.id,
      name: item.name,
      quantity: 1,
      weight: item.weightLb,
      costGp: item.costGp,
      slot: "shield",
      shield: {
        acBonus: item.armorBonus,
        checkPenalty: item.armorCheckPenalty,
      },
    });
  }

  function applyArmorTemplate(index: number, itemId: string) {
    const item = ARMOR_OPTIONS.find(
      (option) =>
        option.id === itemId && option.categoryNormalized !== "shield",
    );
    if (!item) return;
    applyEquipmentCatalogTemplate(index, item);
  }

  function applyShieldTemplate(index: number, itemId: string) {
    const item = ARMOR_OPTIONS.find(
      (option) =>
        option.id === itemId && option.categoryNormalized === "shield",
    );
    if (!item) return;
    applyEquipmentCatalogTemplate(index, item);
  }

  function stepMagicItemTier(index: number, delta: -1 | 1) {
    const currentId = build.equipment?.[index]?.itemTemplateId;
    if (!currentId) return;
    const current = getRuntimeMagicItem(currentId);
    if (!current) return;
    const nextId = delta > 0 ? current.upgradeToId : current.downgradeToId;
    if (!nextId) return;
    const next = getRuntimeMagicItem(nextId);
    if (!next) return;
    applyMagicItemDefinition(index, next);
  }

  function updateEquipment(
    index: number,
    patch: Partial<NonNullable<CharacterBuild["equipment"]>[number]>,
  ) {
    setBuild((prev) => {
      const nextEquipment: NonNullable<CharacterBuild["equipment"]> = (
        prev.equipment ?? []
      ).map((item, i) => {
        if (i !== index) return item;
        const nextItem = { ...item, ...patch };
        if (
          patch.equipped === true &&
          patch.carryState == null &&
          nextItem.carryState !== "carried"
        )
          nextItem.carryState = "carried";
        if (patch.carryState === "cached") nextItem.equipped = false;
        if (patch.ownership === "wishlist") {
          nextItem.equipped = false;
          nextItem.carryState = "cached";
        }
        if (patch.ownership === "owned" && nextItem.carryState === "cached") {
          nextItem.carryState = "stowed";
        }
        return nextItem;
      });
      const nextBuild = {
        ...prev,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          patch.equipped ? index : undefined,
        ),
      };
      return withAmmoAutofill(nextBuild, patch.ammoType);
    });
  }

  function updateEquipmentShield(
    index: number,
    patch: EquipmentShieldEditorState,
  ) {
    setBuild((prev) => {
      const nextEquipment: NonNullable<CharacterBuild["equipment"]> = (
        prev.equipment ?? []
      ).map((item, i) =>
        i === index
          ? {
              ...item,
              slot: patch.enabled
                ? (item.slot ?? "shield")
                : item.slot === "shield"
                  ? undefined
                  : item.slot,
              shield: patch.enabled
                ? {
                    acBonus: patch.acBonus,
                    checkPenalty: patch.checkPenalty,
                  }
                : undefined,
            }
          : item,
      );
      return {
        ...prev,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function updateEquipmentWeapon(
    index: number,
    patch: NonNullable<
      NonNullable<CharacterBuild["equipment"]>[number]["weapon"]
    > & { enabled?: boolean },
  ) {
    setBuild((prev) => {
      const nextBuild = {
        ...prev,
        equipment: (prev.equipment ?? []).map((item, i) => {
          if (i !== index) return item;
          if (patch.enabled === false) return { ...item, weapon: undefined };
          const nextWeapon = {
            weaponTemplateId: patch.weaponTemplateId,
            category: patch.category,
            proficiencyGroup: patch.proficiencyGroup,
            damageDice: patch.damageDice,
            handedness: patch.handedness,
            critRange: patch.critRange,
            critMultiplier: patch.critMultiplier,
            rangeIncrementFeet: patch.rangeIncrementFeet,
            damageTypes: patch.damageTypes,
            specialTags: patch.specialTags,
            ammoType: patch.ammoType,
            loadedAmmoType: patch.loadedAmmoType,
            ammoPerAttack: patch.ammoPerAttack,
            reloadType: patch.reloadType,
            firearmCategory: patch.firearmCategory,
            weaponTechnology: patch.weaponTechnology,
            attackModifier: patch.attackModifier,
            extraDamageDice: patch.extraDamageDice,
            ammoNotes: patch.ammoNotes,
            ordnanceProfile: patch.ordnanceProfile,
            misfire: patch.misfire,
            targetsTouchAcWithinFirstRangeIncrement:
              patch.targetsTouchAcWithinFirstRangeIncrement,
            damageAbility: patch.damageAbility,
          };
          return { ...item, weapon: nextWeapon };
        }),
      };
      return withAmmoAutofill(nextBuild, patch.ammoType);
    });
  }

  function applyEquipmentWeaponTemplate(index: number, weaponId: string) {
    const template = weaponOptions.find((weapon) => weapon.id === weaponId);
    if (!template) return;
    const equipmentTemplate = equipmentWeaponTemplate(template);
    setBuild((prev) => {
      const nextBuild = {
        ...prev,
        equipment: (prev.equipment ?? []).map((item, i) =>
          i === index
            ? {
                ...item,
                name: equipmentTemplate.name,
                weight: equipmentTemplate.weight,
                costGp: equipmentTemplate.costGp,
                weapon: equipmentTemplate.weapon,
              }
            : item,
        ),
      };
      return withAmmoAutofill(nextBuild, equipmentTemplate.weapon.ammoType);
    });
  }

  function updateEquipmentArmor(
    index: number,
    patch: EquipmentArmorEditorState,
  ) {
    setBuild((prev) => {
      const nextEquipment: NonNullable<CharacterBuild["equipment"]> = (
        prev.equipment ?? []
      ).map((item, i) =>
        i === index
          ? {
              ...item,
              slot:
                patch.category === "none"
                  ? item.slot === "armor"
                    ? undefined
                    : item.slot
                  : (item.slot ?? "armor"),
              armor:
                patch.category === "none"
                  ? undefined
                  : {
                      category: patch.category,
                      acBonus: patch.acBonus,
                      maxDexBonus: patch.maxDexBonus,
                      checkPenalty: patch.checkPenalty,
                      speedPenalty: patch.speedPenalty,
                    },
            }
          : item,
      );
      return {
        ...prev,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function removeEquipment(index: number) {
    setBuild((prev) => ({
      ...prev,
      equipment: (prev.equipment ?? []).filter((_, i) => i !== index),
    }));
  }

  function setLevelFeat(levelIndex: number, featIndex: number, value: string) {
    setBuild((prev) => ({
      ...prev,
      levels: prev.levels.map((level, i) => {
        if (i !== levelIndex) return level;
        const current = [...(level.feats ?? [])];
        current[featIndex] = value.trim();
        const cleaned = current.map((feat) => feat.trim());
        while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "")
          cleaned.pop();
        return { ...level, feats: cleaned.length > 0 ? cleaned : undefined };
      }),
    }));
  }

  function updateLevelSkillRank(
    levelIndex: number,
    skillKey: SkillKey,
    value: number,
  ) {
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
    setBuild((prev) => {
      const spellSelections = { ...(prev.spellSelections ?? {}) };
      const classSelections = { ...(spellSelections[classKey] ?? {}) };
      const levelSelections = { ...(classSelections[mode] ?? {}) };

      if (spells.length > 0) levelSelections[level] = spells;
      else delete levelSelections[level];

      if (Object.keys(levelSelections).length > 0)
        classSelections[mode] = levelSelections;
      else delete classSelections[mode];

      if (Object.keys(classSelections).length > 0)
        spellSelections[classKey] = classSelections;
      else delete spellSelections[classKey];

      return {
        ...prev,
        spellSelections:
          Object.keys(spellSelections).length > 0 ? spellSelections : undefined,
      };
    });
  }

  function addSpellSelection(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
  ) {
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
    const current = [
      ...(build.spellSelections?.[classKey]?.[mode]?.[level] ?? []),
    ];
    current[index] = value;
    updateSpellSelections(classKey, mode, level, current);
  }

  function removeSpellSelection(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
    index: number,
  ) {
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    updateSpellSelections(
      classKey,
      mode,
      level,
      current.filter((_, i) => i !== index),
    );
  }

  function resetSpellSelectionsForLevel(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
  ) {
    updateSpellSelections(classKey, mode, level, []);
  }

  function appendSpellSelection(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
    spellName: string,
  ) {
    const trimmed = spellName.trim();
    if (!trimmed) return;
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    if (current.includes(trimmed)) return;
    updateSpellSelections(classKey, mode, level, [...current, trimmed]);
  }

  function resetSpellSelectionsForClass(
    classKey: string,
    mode: "prepared" | "known",
    _levels: number[],
  ) {
    setBuild((prev) => {
      const spellSelections = { ...(prev.spellSelections ?? {}) };
      const classSelections = { ...(spellSelections[classKey] ?? {}) };
      delete classSelections[mode];

      if (Object.keys(classSelections).length > 0)
        spellSelections[classKey] = classSelections;
      else delete spellSelections[classKey];

      return {
        ...prev,
        spellSelections:
          Object.keys(spellSelections).length > 0 ? spellSelections : undefined,
      };
    });
  }

  function updateSpellSpecialization(classKey: string, value: string) {
    setBuild((prev) => ({
      ...prev,
      spellSpecializations: {
        ...(prev.spellSpecializations ?? {}),
        [classKey]: value || undefined,
      },
    }));
  }

  function updateSpellDomains(classKey: string, index: number, value: string) {
    const current = [...(build.spellDomains?.[classKey] ?? [])];
    current[index] = value;
    setBuild((prev) => ({
      ...prev,
      spellDomains: {
        ...(prev.spellDomains ?? {}),
        [classKey]: current,
      },
    }));
  }

  function updateSpellExtraSlots(
    classKey: string,
    level: number,
    value: number,
  ) {
    setBuild((prev) => ({
      ...prev,
      spellExtraSlots: {
        ...(prev.spellExtraSlots ?? {}),
        [classKey]: {
          ...((prev.spellExtraSlots ?? {})[classKey] ?? {}),
          [level]: Math.max(0, value),
        },
      },
    }));
  }

  function adjustSpellExtraSlots(
    classKey: string,
    level: number,
    delta: number,
  ) {
    const current = build.spellExtraSlots?.[classKey]?.[level] ?? 0;
    updateSpellExtraSlots(classKey, level, current + delta);
  }

  function updateSpellLibrary(
    classKey: string,
    level: number,
    spells: string[],
  ) {
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

  function appendSpellLibraryEntry(
    classKey: string,
    level: number,
    spellName: string,
  ) {
    const trimmed = spellName.trim();
    if (!trimmed) return;
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    if (current.includes(trimmed)) return;
    updateSpellLibrary(classKey, level, [...current, trimmed]);
  }

  function updateSpellLibraryName(
    classKey: string,
    level: number,
    index: number,
    value: string,
  ) {
    const current = [...(build.spellLibrary?.[classKey]?.[level] ?? [])];
    current[index] = value;
    updateSpellLibrary(classKey, level, current);
  }

  function removeSpellLibraryEntry(
    classKey: string,
    level: number,
    index: number,
  ) {
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellLibrary(
      classKey,
      level,
      current.filter((_, i) => i !== index),
    );
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

  function fillSelectionsFromLibrary(
    classKey: string,
    mode: "prepared" | "known",
    level: number,
    capacity: number,
  ) {
    const source = build.spellLibrary?.[classKey]?.[level] ?? [];
    const normalized = [
      ...new Set(source.map((spell) => spell.trim()).filter(Boolean)),
    ].slice(0, capacity);
    updateSpellSelections(classKey, mode, level, normalized);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      if (characterId) {
        const snapshot = JSON.stringify({ build, currentLevel });
        if (snapshot === persistedCharacterSnapshot.current) return;
        persistedCharacterSnapshot.current = snapshot;
        saveCharacter(window.localStorage, characterId, build, currentLevel);
        return;
      }
      window.localStorage.setItem(
        CURRENT_BUILD_STORAGE_KEY,
        JSON.stringify(build),
      );
      window.localStorage.setItem(CURRENT_LEVEL_STORAGE_KEY, `${currentLevel}`);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [build, characterId, currentLevel]);

  useEffect(() => {
    function flushPendingPersistence() {
      const pending = pendingPersistence.current;
      if (characterId) {
        const snapshot = JSON.stringify(pending);
        if (snapshot === persistedCharacterSnapshot.current) return;
        persistedCharacterSnapshot.current = snapshot;
        saveCharacter(
          window.localStorage,
          characterId,
          pending.build,
          pending.currentLevel,
        );
        return;
      }
      window.localStorage.setItem(
        CURRENT_BUILD_STORAGE_KEY,
        JSON.stringify(pending.build),
      );
      window.localStorage.setItem(
        CURRENT_LEVEL_STORAGE_KEY,
        `${pending.currentLevel}`,
      );
    }
    window.addEventListener("pagehide", flushPendingPersistence);
    return () => {
      window.removeEventListener("pagehide", flushPendingPersistence);
      flushPendingPersistence();
    };
  }, [characterId]);

  useEffect(() => {
    setCurrentLevel((prev) => Math.max(1, Math.min(build.levels.length, prev)));
  }, [build.levels.length]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setMountedTabs((prev) =>
      prev[activeTab] ? prev : { ...prev, [activeTab]: true },
    );
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      BUILD_SLOTS_STORAGE_KEY,
      JSON.stringify(savedBuildSlots),
    );
  }, [savedBuildSlots]);

  const effectiveBuild = useMemo(
    () =>
      applyWeaponLoadoutsToBuild({
        ...deferredBuild,
        levels: deferredBuild.levels.slice(0, currentLevel),
      }),
    [currentLevel, deferredBuild],
  );

  // The whole app is a pure render of (build + active buffs). Toggle anything
  // and every derived number recomputes instantly — the engine is fast & local.
  const {
    sheet,
    activatableGroups,
    activatableConflicts,
    resourceMaxes,
    resourceLabels,
    runtimeBuffs,
    spellEffectContext,
  } = useMemo(() => {
    const input = buildCharacter(
      {
        ...effectiveBuild,
        conditions: fatigued ? ["fatigued"] : [],
        spellSlotUsage,
      },
      RUNTIME_CLASSES,
      RUNTIME_FEATS,
      RUNTIME_CLASS_FEATURES,
      RUNTIME_ARCHETYPES,
    );
    const baseSheet = computeSheet(input);
    const activatableFeatures = collectActivatableEffects({
      descriptor: baseSheet.descriptor,
      classFeatureRegistry: RUNTIME_CLASS_FEATURES,
      featRegistry: RUNTIME_FEATS,
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
    const spellEffectContext: SpellEffectRuntimeContext = {
      characterLevel: baseSheet.level,
      highestCasterLevel: Math.max(
        0,
        ...baseSheet.spellcasting.map((entry) => entry.casterLevel),
      ),
    };
    const runtimeBuffs = buildRuntimeBuffs(spellEffectContext);
    const resourceMaxes: Record<string, number> = {};
    const resourceLabels: Record<string, string> = {};
    for (const f of activatableFeatures) {
      const max = activatableResourceMax(f, context);
      if (max !== undefined) resourceMaxes[f.id] = max;
    }
    for (const buff of runtimeBuffs) {
      if (buff.trackerMax !== undefined)
        resourceMaxes[buff.id] = buff.trackerMax;
      if (buff.trackerLabel) resourceLabels[buff.id] = buff.trackerLabel;
    }
    const resolvedActivatables = resolveActivatableSelections({
      available: activatableFeatures,
      selected: activeBuffs,
      context,
    });
    const classAbilityMods: Modifier[] = resolvedActivatables.modifiers;
    const buffMods: Modifier[] = runtimeBuffs
      .filter((b) => activeBuffs[b.id])
      .flatMap((b) => b.modifiers);
    const withBuffs = {
      ...input,
      modifiers: [...input.modifiers, ...classAbilityMods, ...buffMods],
    };
    return {
      sheet: computeSheet(withBuffs),
      activatableFeatures,
      activatableGroups: groupActivatables(activatableFeatures),
      activatableConflicts: resolvedActivatables.conflicts,
      resourceMaxes,
      resourceLabels,
      runtimeBuffs,
      spellEffectContext,
    };
  }, [effectiveBuild, activeBuffs, fatigued, spellSlotUsage]);

  const [issues, setIssues] = useState<ReturnType<typeof validateBuild>>(() =>
    validateBuild(
      effectiveBuild,
      RUNTIME_CLASSES,
      RUNTIME_SPELLS,
      RUNTIME_ARCHETYPES,
      RUNTIME_FEATS,
    ),
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIssues(
        validateBuild(
          effectiveBuild,
          RUNTIME_CLASSES,
          RUNTIME_SPELLS,
          RUNTIME_ARCHETYPES,
          RUNTIME_FEATS,
        ),
      );
    }, VALIDATION_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [effectiveBuild]);

  const errors = issues.filter((i) => i.severity === "error");
  const featOptions = useMemo(
    () =>
      listFeats(RUNTIME_FEATS)
        .filter(
          (feat) =>
            !!feat &&
            typeof feat.name === "string" &&
            feat.name.trim().length > 0,
        )
        .map((feat) => ({
          id: feat.id,
          name: feat.name,
          tooltip: [
            feat.name,
            feat.description,
            feat.prerequisites.length
              ? `Prerequisites: ${feat.prerequisites.map((p) => p.description).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          searchText: [
            feat.description,
            feat.prerequisites.map((p) => p.description).join(" "),
            feat.pack,
          ],
          tags: (feat.tags ?? []).map((tag) => tag.toLowerCase()),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const shouldComputeSuggestions = activeTab === "build" || leveling;
  const suggestionBundle = useMemo(
    () =>
      shouldComputeSuggestions
        ? buildSuggestions({
            build: deferredBuild,
            currentLevel,
            sheetSpellcasting: sheet.spellcasting,
            classes: RUNTIME_CLASSES,
            feats: RUNTIME_FEATS,
            spells: RUNTIME_SPELLS,
            classFeatures: RUNTIME_CLASS_FEATURES,
            archetypes: RUNTIME_ARCHETYPES,
            buildGuides: RUNTIME_BUILD_GUIDES,
            includeGuides: false,
          })
        : EMPTY_SUGGESTION_BUNDLE,
    [
      currentLevel,
      deferredBuild,
      leveling,
      shouldComputeSuggestions,
      sheet.spellcasting,
    ],
  );
  const [guidedPlannerSuggestions, setGuidedPlannerSuggestions] = useState<
    Partial<Record<number, LevelPlannerSuggestions>>
  >({});
  const plannerSuggestions = useMemo(
    () =>
      suggestionBundle.planner.map(
        (suggestions, index) => guidedPlannerSuggestions[index] ?? suggestions,
      ),
    [guidedPlannerSuggestions, suggestionBundle.planner],
  );
  function computeGuidedSuggestionBundle(targetBuild: CharacterBuild) {
    return buildSuggestions({
      build: targetBuild,
      currentLevel,
      sheetSpellcasting: sheet.spellcasting,
      classes: RUNTIME_CLASSES,
      feats: RUNTIME_FEATS,
      spells: RUNTIME_SPELLS,
      classFeatures: RUNTIME_CLASS_FEATURES,
      archetypes: RUNTIME_ARCHETYPES,
      buildGuides: RUNTIME_BUILD_GUIDES,
      includeGuides: true,
    });
  }
  const wealthSummary = useMemo(
    () => summarizeWealth(deferredBuild),
    [deferredBuild],
  );
  const runtimeProfile = useMemo<RuntimeProfile>(
    () => ({
      classNames: [
        ...new Set(
          effectiveBuild.levels.map((level) => level.className.toLowerCase()),
        ),
      ],
      meleeFocus:
        sheet.attack.melee.total >= sheet.attack.ranged.total ||
        sheet.abilities.str.score > sheet.abilities.dex.score,
      rangedFocus:
        sheet.attack.ranged.total > sheet.attack.melee.total ||
        !!effectiveBuild.weapons?.some(
          (weapon) => weapon.category === "ranged",
        ) ||
        !!effectiveBuild.equipment?.some(
          (item) => item.weapon?.category === "ranged",
        ),
      casterFocus: sheet.spellcasting.length > 0,
      strengthScore: sheet.abilities.str.score,
      dexScore: sheet.abilities.dex.score,
      conScore: sheet.abilities.con.score,
    }),
    [effectiveBuild, sheet],
  );
  const hpDamageTaken = Math.max(0, resourcesUsed[HP_DAMAGE_RESOURCE_ID] ?? 0);
  const tempHp = Math.max(0, resourcesUsed[TEMP_HP_RESOURCE_ID] ?? 0);
  const nonlethalDamage = Math.max(
    0,
    resourcesUsed[NONLETHAL_DAMAGE_RESOURCE_ID] ?? 0,
  );
  const currentHp = sheet.hitPoints.total - hpDamageTaken;
  const healthStatus = deriveHealthStatus({
    maxHp: sheet.hitPoints.total,
    currentHp,
    constitutionScore: sheet.abilities.con.score,
    nonlethalDamage,
    stable,
  });

  function applyIncomingDamage(amount: number, damageType?: string) {
    const normalized = Math.max(0, amount);
    if (normalized <= 0) return;
    const spellAbsorptions: Array<{
      effectId: string;
      effectName?: string;
      max: number;
    }> = [];
    if (damageType === "physical" && activeBuffs["spell-stoneskin"]) {
      const max = resourceMaxes["spell-stoneskin"];
      if (max !== undefined)
        spellAbsorptions.push({
          effectId: "spell-stoneskin",
          effectName: "Stoneskin",
          max,
        });
    }
    if (
      ["acid", "cold", "electricity", "fire", "sonic"].includes(
        damageType ?? "",
      ) &&
      activeBuffs["spell-protection-from-energy"]
    ) {
      const max = resourceMaxes["spell-protection-from-energy"];
      if (max !== undefined)
        spellAbsorptions.push({
          effectId: "spell-protection-from-energy",
          effectName: "Protection from Energy",
          max,
        });
    }
    applyTrackedDamage(
      normalized,
      damageType,
      HP_DAMAGE_RESOURCE_ID,
      TEMP_HP_RESOURCE_ID,
      spellAbsorptions,
    );
    setFlag(STABLE_FLAG_ID, false);
  }

  function applyHealing(amount: number) {
    const normalized = Math.max(0, amount);
    if (normalized <= 0 || healthStatus.condition === "dead") return;
    adjustResource(HP_DAMAGE_RESOURCE_ID, -normalized);
    const nextHp = Math.min(sheet.hitPoints.total, currentHp + normalized);
    setFlag(STABLE_FLAG_ID, nextHp < 0);
  }

  function applyDirectHpLoss(amount: number) {
    const normalized = Math.max(0, amount);
    if (normalized <= 0) return;
    adjustResource(HP_DAMAGE_RESOURCE_ID, normalized);
    setFlag(STABLE_FLAG_ID, false);
  }

  function applyNonlethalDamage(amount: number) {
    const normalized = Math.max(0, amount);
    if (normalized <= 0) return;
    if (currentHp < 0) {
      applyDirectHpLoss(normalized);
      return;
    }
    adjustResource(NONLETHAL_DAMAGE_RESOURCE_ID, normalized);
  }

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
                onApplyDamage={applyIncomingDamage}
                onApplyHealing={applyHealing}
                onApplyHpLoss={applyDirectHpLoss}
                onSetTempHp={(amount) =>
                  adjustResource(
                    TEMP_HP_RESOURCE_ID,
                    Math.max(0, amount) - tempHp,
                  )
                }
                onApplyNonlethal={applyNonlethalDamage}
                onHealNonlethal={(amount) =>
                  adjustResource(
                    NONLETHAL_DAMAGE_RESOURCE_ID,
                    -Math.max(0, amount),
                  )
                }
                onSetStable={(value) => setFlag(STABLE_FLAG_ID, value)}
                onResetHp={() => {
                  resetResource(HP_DAMAGE_RESOURCE_ID);
                  resetResource(TEMP_HP_RESOURCE_ID);
                  resetResource(NONLETHAL_DAMAGE_RESOURCE_ID);
                  setFlag(STABLE_FLAG_ID, false);
                }}
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
              const guided = computeGuidedSuggestionBundle(nextBuild).planner;
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
              const guidedBundle = computeGuidedSuggestionBundle(build);
              const suggestions = guidedBundle.planner[levelIndex];
              if (!suggestions) return;
              setGuidedPlannerSuggestions((prev) => ({
                ...prev,
                [levelIndex]: suggestions,
              }));
              applyPlannerSuggestions(levelIndex, suggestions);
            }}
            onRequestPlannerSuggestions={(levelIndex) => {
              const suggestions =
                computeGuidedSuggestionBundle(build).planner[levelIndex];
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
