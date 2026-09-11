import { abilityModifier } from "../abilities";
import { computeSheet } from "../compute";
import { spellAccessForEntry } from "../spellcasting";
import {
  effectiveWeaponProficiencyGroup,
  encumbranceRulesEnabled,
  infantrymanGunTrainingPickCount,
} from "../campaign-rules";
import type {
  AbilityKey,
  AbilityScores,
  CharacterInput,
  Modifier,
  NamedAcquisition,
  RaceAlternateTrait,
  RaceChoiceOptions,
  RaceMetadata,
  SheetDescriptor,
  SkillKey,
  SpellAccess,
  SpellExtraSlotsByLevel,
  SpellLibraryState,
  SpellSelectionState,
  SuppressedAcquisition,
  Weapon,
} from "../types";

import {
  babForLevels,
  checkClassPrerequisites,
  classAllowsAlignment,
  getClassDefinition,
  saveBaseForClass,
  SAMPLE_CLASSES,
  type ClassDefinition,
  type ClassRegistry,
  type SaveKind,
} from "./classes";
import { classBonusFeatSlot } from "./feat-grants";
import {
  checkPrerequisites,
  featContextFromSheet,
  featEffects,
  featParameterOptions,
  FEATS,
  parseFeatSelection,
  type FeatRegistry,
} from "../content/feats";
import {
  domainExtraSlots,
  getDomain,
  grantedDomainSpells,
} from "../content/domains";
import {
  getSchool,
  grantedSchoolSpells,
  schoolExtraSlots,
} from "../content/schools";
import {
  classSpellLevel,
  getSpell,
  SPELLS,
  type SpellRegistry,
} from "../content/spells";
import {
  classFeatureEffects,
  classFeaturesGrantedAt,
  suppressedClassFeatures,
  CLASS_FEATURES,
  type ClassFeatureRegistry,
} from "../content/class-features";
import { favoredClassBonusOptions } from "../death-rules";
import { deriveEncumbrance } from "../encumbrance";
import {
  applyArchetypeClassOverrides,
  archetypeDisablesDomains,
  archetypeGrantedFeatNames,
  archetypePassiveModifiers,
  archetypeSkillUsableOverrides,
  type ArchetypeDefinitionLike,
  type ArchetypeRegistry,
} from "./archetype-rules";
import {
  EQUIPMENT_SLOT_CAPACITY,
  EQUIPMENT_SLOTS,
  type CharacterBuild,
  type EquipmentEntry,
  type EquipmentOwnership,
  type EquipmentSlot,
  type FeatGrantSlot,
  type LevelEntry,
  type LevelUpPlan,
  type LevelUpSelection,
  type PreLevelBuildResult,
  type PreLevelBuildSelection,
  type RaceChoice,
  type ValidationIssue,
} from "./types";
export type {
  ArchetypeDefinitionLike,
  ArchetypeFeatureLike,
  ArchetypeRegistry,
} from "./archetype-rules";
export { EQUIPMENT_SLOT_CAPACITY, EQUIPMENT_SLOTS } from "./types";
export { validateLevelUpSelection } from "./level-up-validation";
export type {
  CharacterBuild,
  EquipmentEntry,
  EquipmentSlot,
  FeatGrantSlot,
  LevelEntry,
  LevelUpPlan,
  LevelUpSelection,
  PreLevelBuildResult,
  PreLevelBuildSelection,
  RaceChoice,
  RaceChoiceSelection,
  ValidationIssue,
  ValidationSeverity,
} from "./types";

const SAVES: readonly SaveKind[] = ["fort", "ref", "will"];

/** Append a level to a build, returning a NEW build (pure; enables undo). */
export function levelUp(
  build: CharacterBuild,
  entry: LevelEntry,
): CharacterBuild {
  return { ...build, levels: [...build.levels, entry] };
}

/** Remove the last level, returning a NEW build (the "undo" of levelUp). */
export function levelDown(build: CharacterBuild): CharacterBuild {
  return { ...build, levels: build.levels.slice(0, -1) };
}

/** Count how many levels were taken in each class. */
export function classLevelCounts(build: CharacterBuild): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lvl of build.levels) {
    const key = lvl.className.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Effective base ability scores (point-buy + permanent level increases). */
function effectiveBaseScores(build: CharacterBuild): AbilityScores {
  const scores: AbilityScores = { ...build.baseAbilityScores };
  for (const lvl of build.levels) {
    if (lvl.abilityIncrease) scores[lvl.abilityIncrease] += 1;
  }
  return scores;
}

function mergeChoiceOptions(
  base: RaceChoiceOptions | undefined,
  patch: Partial<RaceChoiceOptions> | undefined,
  removals: Array<keyof RaceChoiceOptions> | undefined,
) {
  const next: RaceChoiceOptions = { ...(base ?? {}) };
  for (const key of removals ?? []) delete next[key];
  if (!patch) return next;
  if (patch.flexibleAbilityBonus !== undefined)
    next.flexibleAbilityBonus = patch.flexibleAbilityBonus;
  if (patch.bonusFeat !== undefined) next.bonusFeat = patch.bonusFeat;
  if (patch.extraSkillRanksPerLevel !== undefined)
    next.extraSkillRanksPerLevel = patch.extraSkillRanksPerLevel;
  return next;
}

function mergeMovementModes(
  ...parts: Array<RaceMetadata["movementModes"] | undefined>
): RaceMetadata["movementModes"] | undefined {
  const merged = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeResistances(
  ...parts: Array<RaceMetadata["resistances"] | undefined>
): RaceMetadata["resistances"] | undefined {
  const merged = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function activeRaceAlternateTraits(race: RaceChoice): RaceAlternateTrait[] {
  const selectedIds = new Set(
    (race.choiceSelection?.alternateTraits ?? []).map((id) => id.toLowerCase()),
  );
  return (race.alternateTraits ?? []).filter((trait) =>
    selectedIds.has(trait.id.toLowerCase()),
  );
}

export function resolveRaceChoice(race: RaceChoice): RaceChoice {
  const activeTraits = activeRaceAlternateTraits(race);
  const replacedTraits = new Set(
    activeTraits
      .flatMap((trait) => trait.replaces ?? [])
      .map(normalizeWeaponName),
  );
  let choiceOptions = { ...(race.choiceOptions ?? {}) };
  for (const trait of activeTraits) {
    choiceOptions = mergeChoiceOptions(
      choiceOptions,
      trait.choiceOptions,
      trait.removeChoiceOptions,
    );
  }
  return {
    ...race,
    languageRules: Object.assign(
      {},
      race.languageRules,
      ...activeTraits.map((trait) => trait.languageRules),
    ),
    speed: activeTraits.reduce(
      (speed, trait) => trait.speed ?? speed,
      race.speed,
    ),
    abilityModifiers: [
      ...(race.abilityModifiers ?? []),
      ...activeTraits.flatMap((trait) => trait.abilityModifiers ?? []),
    ],
    traits: [
      ...(race.traits ?? []).filter(
        (trait) => !replacedTraits.has(normalizeWeaponName(trait.source)),
      ),
      ...activeTraits.flatMap((trait) => trait.traits ?? []),
    ],
    classSkills: [
      ...new Set([
        ...(race.classSkills ?? []),
        ...activeTraits.flatMap((trait) => trait.classSkills ?? []),
      ]),
    ],
    weaponProficiencies: [
      ...new Set([
        ...(race.weaponProficiencies ?? []),
        ...activeTraits.flatMap((trait) => trait.weaponProficiencies ?? []),
      ]),
    ],
    specificWeaponProficiencies: [
      ...new Set([
        ...(race.specificWeaponProficiencies ?? []),
        ...activeTraits.flatMap(
          (trait) => trait.specificWeaponProficiencies ?? [],
        ),
      ]),
    ],
    grantedWeapons: [
      ...(race.grantedWeapons ?? []),
      ...activeTraits.flatMap((trait) => trait.grantedWeapons ?? []),
    ],
    movementModes: mergeMovementModes(
      race.movementModes,
      ...activeTraits.map((trait) => trait.movementModes),
    ),
    senses: Object.assign(
      {},
      race.senses ?? {},
      ...activeTraits.map((trait) => trait.senses ?? {}),
    ),
    resistances: mergeResistances(
      race.resistances,
      ...activeTraits.map((trait) => trait.resistances),
    ),
    ferocity: replacedTraits.has("orc ferocity") ? undefined : race.ferocity,
    weaponFamiliarity: replacedTraits.has(
      normalizeWeaponName(race.weaponFamiliarity?.source ?? ""),
    )
      ? undefined
      : (activeTraits.find((trait) => trait.weaponFamiliarity)
          ?.weaponFamiliarity ?? race.weaponFamiliarity),
    notes: [
      ...(race.notes ?? []),
      ...activeTraits.map(
        (trait) =>
          `Alternate racial trait: ${trait.name}${trait.replaces?.length ? ` (replaces ${trait.replaces.join(", ")})` : ""}`,
      ),
      ...activeTraits.flatMap((trait) => trait.notes ?? []),
    ],
    choiceOptions,
  };
}

function raceFlexibleAbilityModifier(race: RaceChoice): Modifier[] {
  const bonus = race.choiceOptions?.flexibleAbilityBonus;
  const ability = race.choiceSelection?.flexibleAbility;
  if (!bonus || !ability) return [];
  const allowedAbilities = bonus.abilities ?? [
    "str",
    "dex",
    "con",
    "int",
    "wis",
    "cha",
  ];
  if (!allowedAbilities.includes(ability)) return [];
  return [
    {
      target: ability,
      type: "racial",
      value: bonus.value,
      source: `${race.name} flexible bonus`,
    },
  ];
}

function raceAbilityModifiers(race: RaceChoice): Modifier[] {
  return [
    ...(race.abilityModifiers ?? []),
    ...raceFlexibleAbilityModifier(race),
  ];
}

function raceBonusFeatNames(race: RaceChoice): string[] {
  const feat = race.choiceSelection?.bonusFeat?.trim();
  return feat ? [feat] : [];
}

function raceExtraSkillRanksPerLevel(race: RaceChoice) {
  return Math.max(0, race.choiceOptions?.extraSkillRanksPerLevel ?? 0);
}

function raceChoiceNotes(race: RaceChoice): string[] {
  const notes: string[] = [];
  const flexibleAbility = race.choiceSelection?.flexibleAbility;
  const flexibleValue = race.choiceOptions?.flexibleAbilityBonus?.value;
  if (flexibleAbility && flexibleValue)
    notes.push(
      `Flexible racial bonus: ${flexibleAbility.toUpperCase()} ${flexibleValue >= 0 ? `+${flexibleValue}` : flexibleValue}`,
    );
  const bonusFeat = race.choiceSelection?.bonusFeat?.trim();
  if (bonusFeat) notes.push(`Bonus feat: ${bonusFeat}`);
  const extraSkillRanks = raceExtraSkillRanksPerLevel(race);
  if (extraSkillRanks > 0)
    notes.push(`Extra skill rank per level: +${extraSkillRanks}`);
  return notes;
}

function equipmentQuantity(item: EquipmentEntry): number {
  const quantity = item.quantity ?? 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function equippedEquipment(
  equipment: EquipmentEntry[] | undefined,
): EquipmentEntry[] {
  return (equipment ?? []).filter((item) => item.equipped);
}

function equippedArmorEntries(
  equipment: EquipmentEntry[] | undefined,
): EquipmentEntry[] {
  return equippedEquipment(equipment).filter((item) => !!item.armor?.category);
}

function equippedShieldEntries(
  equipment: EquipmentEntry[] | undefined,
): EquipmentEntry[] {
  return equippedEquipment(equipment).filter((item) => !!item.shield);
}

function normalizeWeaponName(name: string): string {
  return name.trim().toLowerCase();
}

function weaponDamageAbilityOverridesForBuild(
  build: CharacterBuild,
): Partial<Record<string, AbilityKey | null>> {
  const overrides: Partial<Record<string, AbilityKey | null>> = {
    ...(build.weaponDamageAbilityOverrides ?? {}),
  };
  const counts = classLevelCounts(build);
  const infantrymanLevel = counts.get("infantryman") ?? 0;
  const infantrymanPickCount = infantrymanGunTrainingPickCount(
    infantrymanLevel,
    build.campaignRules,
  );
  if (infantrymanPickCount > 0) {
    for (const weaponName of (
      build.gunTrainingSelections?.infantryman ?? []
    ).slice(0, infantrymanPickCount)) {
      const normalized = normalizeWeaponName(weaponName);
      overrides[normalized] = "dex";
    }
  }
  return overrides;
}

function effectiveWeaponGroupForBuild(
  weapon: Weapon,
  campaignRules?: CharacterBuild["campaignRules"],
  familiarity?: RaceChoice["weaponFamiliarity"],
) {
  const normalizedName = normalizeWeaponName(weapon.name);
  const effectiveGroup = effectiveWeaponProficiencyGroup(weapon, campaignRules);
  return effectiveGroup === "exotic" &&
    familiarity?.martialWeaponNameIncludes?.some((fragment) =>
      normalizedName.includes(normalizeWeaponName(fragment)),
    )
    ? "martial"
    : effectiveGroup;
}

function isWeaponProficient(
  weapon: Weapon,
  weaponProficiencies: ReadonlySet<"simple" | "martial" | "exotic">,
  specificWeaponProficiencies: ReadonlySet<string>,
  campaignRules?: CharacterBuild["campaignRules"],
  familiarity?: RaceChoice["weaponFamiliarity"],
): boolean {
  const normalizedName = normalizeWeaponName(weapon.name);
  if (
    specificWeaponProficiencies.has(normalizedName) ||
    familiarity?.specificWeapons?.some(
      (name) => normalizeWeaponName(name) === normalizedName,
    )
  )
    return true;
  const effectiveGroup = effectiveWeaponGroupForBuild(
    weapon,
    campaignRules,
    familiarity,
  );
  if (effectiveGroup) return weaponProficiencies.has(effectiveGroup);
  return true;
}

function equipmentOwnership(item: EquipmentEntry): EquipmentOwnership {
  return item.ownership ?? "owned";
}

function equipmentIsOwned(item: EquipmentEntry) {
  return equipmentOwnership(item) === "owned";
}

function equipmentCountsTowardWeight(item: EquipmentEntry) {
  return equipmentIsOwned(item) && (item.carryState ?? "stowed") !== "cached";
}

function sumEquipmentWeight(equipment: EquipmentEntry[] | undefined): number {
  return (equipment ?? []).reduce(
    (sum, item) =>
      sum +
      (equipmentCountsTowardWeight(item)
        ? (item.weight ?? 0) * equipmentQuantity(item)
        : 0),
    0,
  );
}

function coinCount(coinPurse: CharacterBuild["coinPurse"] | undefined) {
  const pp = Math.max(0, Math.floor(coinPurse?.pp ?? 0));
  const gp = Math.max(0, Math.floor(coinPurse?.gp ?? 0));
  const sp = Math.max(0, Math.floor(coinPurse?.sp ?? 0));
  const cp = Math.max(0, Math.floor(coinPurse?.cp ?? 0));
  return { pp, gp, sp, cp, total: pp + gp + sp + cp };
}

function coinWeight(coinPurse: CharacterBuild["coinPurse"] | undefined) {
  return coinCount(coinPurse).total / 50;
}

function inventorySummary(equipment: EquipmentEntry[] | undefined) {
  const items = (equipment ?? []).filter(equipmentIsOwned);
  return {
    itemCount: items.reduce((sum, item) => sum + equipmentQuantity(item), 0),
    equippedCount: items
      .filter((item) => item.equipped)
      .reduce((sum, item) => sum + equipmentQuantity(item), 0),
    totalWeight: sumEquipmentWeight(items),
    totalCostGp: items.reduce(
      (sum, item) => sum + (item.costGp ?? 0) * equipmentQuantity(item),
      0,
    ),
  };
}

function mergeSpellLibraries(
  ...libraries: Array<SpellLibraryState | undefined>
): SpellLibraryState {
  const out: SpellLibraryState = {};
  for (const library of libraries) {
    for (const [levelText, names] of Object.entries(library ?? {})) {
      const level = Number(levelText);
      const current = out[level] ?? [];
      for (const name of names ?? []) {
        if (!current.includes(name)) current.push(name);
      }
      if (current.length > 0) out[level] = current;
    }
  }
  return out;
}

function inventoryItems(equipment: EquipmentEntry[] | undefined) {
  return (equipment ?? []).filter(equipmentIsOwned).map((item) => {
    const quantity = equipmentQuantity(item);
    const weightEach = item.weight ?? 0;
    const costEachGp = item.costGp ?? 0;
    return {
      name: item.name,
      quantity,
      weightEach,
      totalWeight: weightEach * quantity,
      costEachGp,
      totalCostGp: costEachGp * quantity,
      equipped: !!item.equipped,
      carryState: item.carryState,
      slot: item.slot,
      ownership: equipmentOwnership(item),
      containerName: item.containerName,
      containerCapacityLb: item.containerCapacityLb,
      componentCategory: item.componentCategory,
      spellTriggerNames: item.spellTriggerNames,
      ammoType: item.ammoType,
      usesRemaining: item.usesRemaining,
      usesMax: item.usesMax,
      armor: item.armor?.category
        ? {
            category: item.armor.category,
            acBonus: item.armor.acBonus,
            maxDexBonus: item.armor.maxDexBonus,
            checkPenalty: item.armor.checkPenalty,
            speedPenalty: item.armor.speedPenalty,
            speed30: item.armor.speed30,
            speed20: item.armor.speed20,
          }
        : undefined,
      shield:
        item.shield?.acBonus !== undefined ||
        item.shield?.checkPenalty !== undefined
          ? {
              acBonus: item.shield.acBonus,
              checkPenalty: item.shield.checkPenalty,
            }
          : undefined,
      weapon: item.weapon
        ? {
            weaponTemplateId: item.weapon.weaponTemplateId,
            category: item.weapon.category,
            proficiencyGroup: item.weapon.proficiencyGroup,
            damageDice: item.weapon.damageDice,
            handedness: item.weapon.handedness,
            critRange: item.weapon.critRange,
            critMultiplier: item.weapon.critMultiplier,
            rangeIncrementFeet: item.weapon.rangeIncrementFeet,
            damageTypes: item.weapon.damageTypes,
            specialTags: item.weapon.specialTags,
            ammoType: item.weapon.ammoType,
            loadedAmmoType: item.weapon.loadedAmmoType,
            ammoPerAttack: item.weapon.ammoPerAttack,
            reloadType: item.weapon.reloadType,
            firearmCategory: item.weapon.firearmCategory,
            weaponTechnology: item.weapon.weaponTechnology,
            attackModifier: item.weapon.attackModifier,
            extraDamageDice: item.weapon.extraDamageDice,
            ammoNotes: item.weapon.ammoNotes,
            ordnanceProfile: item.weapon.ordnanceProfile,
            misfire: item.weapon.misfire,
            targetsTouchAcWithinFirstRangeIncrement:
              item.weapon.targetsTouchAcWithinFirstRangeIncrement,
            damageAbility: item.weapon.damageAbility,
          }
        : undefined,
    };
  });
}

function liquidWealthGp(coinPurse: CharacterBuild["coinPurse"] | undefined) {
  const purse = coinCount(coinPurse);
  return purse.pp * 10 + purse.gp + purse.sp / 10 + purse.cp / 100;
}

function wishlistCostGp(equipment: EquipmentEntry[] | undefined) {
  return (equipment ?? [])
    .filter((item) => equipmentOwnership(item) === "wishlist")
    .reduce(
      (sum, item) => sum + (item.costGp ?? 0) * equipmentQuantity(item),
      0,
    );
}

function analyzeContainers(equipment: EquipmentEntry[] | undefined) {
  const owned = (equipment ?? []).filter(equipmentIsOwned);
  const containers = owned
    .filter((item) => item.containerCapacityLb !== undefined)
    .map((item) => ({
      item,
      name: item.name.trim(),
      normalizedName: item.name.trim().toLowerCase(),
      capacityLb: item.containerCapacityLb,
    }))
    .filter((entry) => entry.name.length > 0);
  const containerNameCounts = new Map<string, number>();
  for (const container of containers) {
    containerNameCounts.set(
      container.normalizedName,
      (containerNameCounts.get(container.normalizedName) ?? 0) + 1,
    );
  }
  const duplicateNames = [...containerNameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(
      ([normalizedName]) =>
        containers.find((entry) => entry.normalizedName === normalizedName)
          ?.name,
    )
    .filter((name): name is string => !!name);
  const availableNames = new Set(
    containers.map((entry) => entry.normalizedName),
  );
  const missingAssignments = owned.filter((item) => {
    const containerName = item.containerName?.trim().toLowerCase();
    return !!containerName && !availableNames.has(containerName);
  });
  const selfAssignments = owned.filter((item) => {
    const containerName = item.containerName?.trim().toLowerCase();
    return !!containerName && containerName === item.name.trim().toLowerCase();
  });
  const overloaded = containers
    .map((container) => {
      const contentsWeightLb = owned
        .filter(
          (item) =>
            item !== container.item &&
            item.containerName?.trim().toLowerCase() ===
              container.normalizedName,
        )
        .reduce(
          (sum, item) => sum + (item.weight ?? 0) * equipmentQuantity(item),
          0,
        );
      return {
        name: container.name,
        capacityLb: container.capacityLb,
        contentsWeightLb,
        overloaded:
          typeof container.capacityLb === "number"
            ? contentsWeightLb > container.capacityLb
            : false,
      };
    })
    .filter((entry) => entry.overloaded);
  return { duplicateNames, missingAssignments, selfAssignments, overloaded };
}

function equippedWeaponsFromEquipment(
  equipment: EquipmentEntry[] | undefined,
): Weapon[] {
  return (equipment ?? []).flatMap((item, index) => {
    if (!item.equipped || item.carryState === "cached" || !item.weapon)
      return [];
    return [
      {
        name: item.name,
        weaponTemplateId: item.weapon.weaponTemplateId,
        category: item.weapon.category ?? "melee",
        proficiencyGroup: item.weapon.proficiencyGroup,
        damageDice: item.weapon.damageDice ?? "1d6",
        handedness: item.weapon.handedness,
        critRange: item.weapon.critRange,
        critMultiplier: item.weapon.critMultiplier,
        rangeIncrementFeet: item.weapon.rangeIncrementFeet,
        damageTypes: item.weapon.damageTypes,
        specialTags: item.weapon.specialTags,
        ammoType: item.weapon.ammoType,
        loadedAmmoType: item.weapon.loadedAmmoType,
        ammoPerAttack: item.weapon.ammoPerAttack,
        ammoConsumptions: item.weapon.ammoConsumptions,
        reloadType: item.weapon.reloadType,
        firearmCategory: item.weapon.firearmCategory,
        weaponTechnology: item.weapon.weaponTechnology,
        attackModifier: item.weapon.attackModifier,
        extraDamageDice: item.weapon.extraDamageDice,
        ammoNotes: item.weapon.ammoNotes,
        ordnanceProfile: item.weapon.ordnanceProfile,
        sourceKind: "equipment" as const,
        sourceIndex: index,
        misfire: item.weapon.misfire,
        targetsTouchAcWithinFirstRangeIncrement:
          item.weapon.targetsTouchAcWithinFirstRangeIncrement,
        damageAbility: item.weapon.damageAbility,
      },
    ];
  });
}

function bonusSpellSlotsForLevel(
  castingAbilityMod: number,
  spellLevel: number,
): number {
  if (spellLevel <= 0) return 0;
  return Math.max(0, Math.floor((castingAbilityMod - spellLevel) / 4) + 1);
}

function canCastSpellLevel(
  castingAbilityScore: number,
  spellLevel: number,
): boolean {
  if (spellLevel <= 0) return true;
  return castingAbilityScore >= 10 + spellLevel;
}

function selectedArchetypeIds(
  build: CharacterBuild,
  className: string,
): string[] {
  const ids = build.classArchetypes?.[className.toLowerCase()] ?? [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function archetypeFeatureBuckets(archetype: ArchetypeDefinitionLike): string[] {
  return [
    ...(archetype.replaces ?? []),
    ...(archetype.alters ?? []),
    ...(archetype.modifies ?? []),
  ]
    .map((feature) => feature.trim().toLowerCase())
    .filter(Boolean);
}

function featSelectionBaseName(selection: string): string {
  const trimmed = selection.trim();
  const match = /^(.*?)\s*\(.+\)\s*$/.exec(trimmed);
  return (match?.[1] ?? trimmed).trim().toLowerCase();
}

function selectedArchetypesForClass(
  build: CharacterBuild,
  className: string,
  archetypeRegistry?: ArchetypeRegistry,
): ArchetypeDefinitionLike[] {
  if (!archetypeRegistry) return [];
  return selectedArchetypeIds(build, className)
    .map((id) => archetypeRegistry[id.toLowerCase()])
    .filter(
      (archetype): archetype is ArchetypeDefinitionLike =>
        !!archetype &&
        archetype.baseClassName.toLowerCase() === className.toLowerCase(),
    );
}

function resolvedClassDefinition(
  registry: ClassRegistry,
  build: CharacterBuild,
  className: string,
  archetypeRegistry?: ArchetypeRegistry,
): ClassDefinition | undefined {
  const base = getClassDefinition(registry, className);
  if (!base) return undefined;
  const archetypes = selectedArchetypesForClass(
    build,
    base.name,
    archetypeRegistry,
  );
  return archetypes.length > 0
    ? applyArchetypeClassOverrides(base, archetypes)
    : base;
}

function effectiveSpellcastingSelections(
  build: CharacterBuild,
  registry: ClassRegistry,
  archetypeRegistry?: ArchetypeRegistry,
): Array<{
  className: string;
  classLevel: number;
  castingType: "prepared" | "spontaneous";
  spellAccess: SpellAccess;
  domains: string[];
  specialistSchool?: string;
  spellsPerDay: Partial<Record<number, number>>;
  spellsKnown: Partial<Record<number, number>>;
  extraSlots: Partial<Record<number, number>>;
  restrictedExtraSlots: Partial<Record<number, number>>;
  grantedSpells: SpellLibraryState;
  castingAbilityScore: number;
  castingAbilityMod: number;
  selections: SpellSelectionState | undefined;
}> {
  return [...classLevelCounts(build).entries()].flatMap(
    ([className, classLevel]) => {
      const def = resolvedClassDefinition(
        registry,
        build,
        className,
        archetypeRegistry,
      );
      if (!def?.spellcasting) return [];
      const classArchetypes = selectedArchetypesForClass(
        build,
        def.name,
        archetypeRegistry,
      );
      const domainsEnabled =
        def.name.toLowerCase() === "cleric" &&
        !archetypeDisablesDomains(classArchetypes);
      const selectedDomains = domainsEnabled
        ? (
            build.spellDomains?.[className] ??
            build.spellDomains?.[def.name.toLowerCase()] ??
            []
          )
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : [];
      const specialistSchool =
        build.spellSpecializations?.[className] ??
        build.spellSpecializations?.[def.name.toLowerCase()];
      const manualExtraSlots =
        build.spellExtraSlots?.[className] ??
        build.spellExtraSlots?.[def.name.toLowerCase()] ??
        {};
      const autoDomainExtraSlotsRaw = domainsEnabled
        ? domainExtraSlots(selectedDomains)
        : {};
      const autoSchoolExtraSlotsRaw =
        def.name.toLowerCase() === "wizard"
          ? schoolExtraSlots(specialistSchool)
          : {};
      const autoDomainExtraSlots: SpellExtraSlotsByLevel = {};
      const spellsPerDay = def.spellcasting.spellsPerDay[classLevel] ?? {};
      for (const [levelKey, slots] of Object.entries(autoDomainExtraSlotsRaw)) {
        const level = Number(levelKey);
        const slotCount = typeof slots === "number" ? slots : 0;
        if ((spellsPerDay[level] ?? 0) > 0 && slotCount > 0)
          autoDomainExtraSlots[level] = slotCount;
      }
      const autoSchoolExtraSlots: SpellExtraSlotsByLevel = {};
      for (const [levelKey, slots] of Object.entries(autoSchoolExtraSlotsRaw)) {
        const level = Number(levelKey);
        const slotCount = typeof slots === "number" ? slots : 0;
        if ((spellsPerDay[level] ?? 0) > 0 && slotCount > 0)
          autoSchoolExtraSlots[level] = slotCount;
      }
      const restrictedExtraSlots: SpellExtraSlotsByLevel = {};
      for (const levelKey of new Set([
        ...Object.keys(autoDomainExtraSlots),
        ...Object.keys(autoSchoolExtraSlots),
      ])) {
        const level = Number(levelKey);
        restrictedExtraSlots[level] =
          (autoDomainExtraSlots[level] ?? 0) +
          (autoSchoolExtraSlots[level] ?? 0);
      }
      const mergedExtraSlots: SpellExtraSlotsByLevel = {};
      for (const levelKey of new Set([
        ...Object.keys(restrictedExtraSlots),
        ...Object.keys(manualExtraSlots),
      ])) {
        const level = Number(levelKey);
        mergedExtraSlots[level] =
          (restrictedExtraSlots[level] ?? 0) + (manualExtraSlots[level] ?? 0);
      }
      return [
        {
          className: def.name,
          classLevel,
          castingType: def.spellcasting.castingType,
          spellAccess: spellAccessForEntry({
            className: def.name,
            ...def.spellcasting,
          }),
          domains: selectedDomains,
          specialistSchool,
          spellsPerDay,
          spellsKnown: def.spellcasting.spellsKnown?.[classLevel] ?? {},
          extraSlots: mergedExtraSlots,
          restrictedExtraSlots,
          grantedSpells: mergeSpellLibraries(
            domainsEnabled ? grantedDomainSpells(selectedDomains) : {},
            grantedSchoolSpells(specialistSchool),
          ),
          castingAbilityScore: effectiveAbilityScore(
            build,
            def.spellcasting.castingAbility,
          ),
          castingAbilityMod: effectiveAbilityMod(
            build,
            def.spellcasting.castingAbility,
          ),
          selections:
            build.spellSelections?.[className] ??
            build.spellSelections?.[def.name.toLowerCase()],
        },
      ];
    },
  );
}

/**
 * Replay a build into a normalized CharacterInput. This is the bridge between
 * the build/level-up layer and the pure derivation engine: buildCharacter()
 * produces the input, computeSheet() turns it into a sheet.
 */
function replacedFeatureLabels(
  archetypes: ArchetypeDefinitionLike[],
): Set<string> {
  return new Set(
    archetypes
      .flatMap((archetype) => archetype.replaces ?? [])
      .map((label) => label.toLowerCase()),
  );
}

function isFeatureReplacedByArchetype(
  featureName: string,
  archetypes: ArchetypeDefinitionLike[],
): boolean {
  const lowered = featureName.toLowerCase();
  return archetypes.some((archetype) =>
    (archetype.replaces ?? []).some(
      (label) =>
        lowered.includes(label.toLowerCase()) ||
        label.toLowerCase().includes(lowered),
    ),
  );
}

export function buildCharacter(
  build: CharacterBuild,
  registry: ClassRegistry = SAMPLE_CLASSES,
  featRegistry: FeatRegistry = FEATS,
  classFeatureRegistry: ClassFeatureRegistry = CLASS_FEATURES,
  archetypeRegistry?: ArchetypeRegistry,
): CharacterInput {
  const counts = classLevelCounts(build);
  const level = build.levels.length;
  const activeRace = resolveRaceChoice(build.race);

  // BAB + saves: sum each class's progression over its own level count.
  let baseAttackBonus = 0;
  const baseSaves: Record<SaveKind, number> = { fort: 0, ref: 0, will: 0 };
  const classSkillSet = new Set<SkillKey>(activeRace.classSkills ?? []);

  for (const [className, count] of counts) {
    const def = resolvedClassDefinition(
      registry,
      build,
      className,
      archetypeRegistry,
    );
    if (!def) continue; // validateBuild surfaces the error separately
    baseAttackBonus += babForLevels(def.bab, count);
    for (const save of SAVES) {
      baseSaves[save] += saveBaseForClass(def, count, save);
    }
    for (const skill of def.classSkills) classSkillSet.add(skill);
  }

  // Modifiers: race + traits + per-level + equipment + favored-class HP + other.
  const modifiers: Modifier[] = [
    ...raceAbilityModifiers(activeRace),
    ...(activeRace.traits ?? []),
    ...featEffects(
      raceBonusFeatNames(activeRace),
      featRegistry,
      build.levels.length,
    ),
  ];
  const damageReductions: NonNullable<CharacterInput["damageReductions"]> = [];

  // Equipment-derived legality context.
  let armorCategory: "none" | "light" | "medium" | "heavy" = "none";
  for (const item of equippedArmorEntries(
    (build.equipment ?? []).filter(equipmentIsOwned),
  )) {
    const cat = item.armor?.category;
    if (cat === "heavy") armorCategory = "heavy";
    else if (cat === "medium" && armorCategory !== "heavy")
      armorCategory = "medium";
    else if (cat === "light" && armorCategory === "none")
      armorCategory = "light";
  }
  const baseScores = effectiveBaseScores(build);
  const baseStr =
    baseScores.str + sumRacialAbility(raceAbilityModifiers(activeRace), "str");
  const equipmentInventory = inventorySummary(build.equipment);
  const equipmentInventoryItems = inventoryItems(build.equipment);
  const derivedCarriedWeight =
    equipmentInventory.totalWeight +
    ((build.coinWeightCountsTowardEncumbrance ?? true)
      ? coinWeight(build.coinPurse)
      : 0);
  const carriedWeight = derivedCarriedWeight;
  const ignoreEncumbrance = !encumbranceRulesEnabled(build.campaignRules);
  const encumbrance = deriveEncumbrance(
    baseStr,
    carriedWeight,
    ignoreEncumbrance,
  );
  const weaponProficiencies = new Set<"simple" | "martial" | "exotic">(
    activeRace.weaponProficiencies ?? [],
  );
  const specificWeaponProficiencies = new Set<string>(
    (activeRace.specificWeaponProficiencies ?? []).map((weaponName) =>
      normalizeWeaponName(weaponName),
    ),
  );
  for (const [className] of counts) {
    const def = resolvedClassDefinition(
      registry,
      build,
      className,
      archetypeRegistry,
    );
    for (const weapon of def?.weaponProficiencies ?? [])
      weaponProficiencies.add(weapon);
    for (const weaponName of def?.specificWeaponProficiencies ?? []) {
      specificWeaponProficiencies.add(normalizeWeaponName(weaponName));
    }
  }

  const skillUsableOverrides: Partial<Record<SkillKey, boolean>> = {};
  for (const [className] of counts) {
    const classArchetypes = selectedArchetypesForClass(
      build,
      className,
      archetypeRegistry,
    );
    Object.assign(
      skillUsableOverrides,
      archetypeSkillUsableOverrides(classArchetypes),
    );
  }

  const classProgress = new Map<string, number>();
  const autoGrantedFeatures: NamedAcquisition[] = [];
  const autoGrantedArchetypes: NamedAcquisition[] = [];
  const autoGrantedFeats: NamedAcquisition[] = [];
  const autoSuppressedFeatures: SuppressedAcquisition[] = [];
  let characterLevelIndex = 0;
  for (const lvl of build.levels) {
    characterLevelIndex += 1;
    const classKey = lvl.className.toLowerCase();
    const classLevel = (classProgress.get(classKey) ?? 0) + 1;
    classProgress.set(classKey, classLevel);

    const granted = classFeaturesGrantedAt(
      classFeatureRegistry,
      lvl.className,
      classLevel,
    );
    const classArchetypes = selectedArchetypesForClass(
      build,
      lvl.className,
      archetypeRegistry,
    );
    const replacedLabels = replacedFeatureLabels(classArchetypes);
    if (classLevel === 1) {
      for (const archetype of classArchetypes) {
        autoGrantedArchetypes.push({
          name: archetype.name,
          level: characterLevelIndex,
        });
        for (const replaced of archetype.replaces ?? []) {
          autoSuppressedFeatures.push({
            name: replaced,
            level: characterLevelIndex,
            reason: `replaced by archetype (${archetype.name})`,
          });
        }
      }
    }
    for (const archetype of classArchetypes) {
      for (const feature of archetype.features ?? []) {
        if (feature.level === classLevel) {
          autoGrantedFeatures.push({
            name: feature.name,
            level: characterLevelIndex,
          });
        }
      }
      for (const featName of archetypeGrantedFeatNames(archetype, classLevel)) {
        autoGrantedFeats.push({ name: featName, level: characterLevelIndex });
      }
    }
    for (const g of granted) {
      if (isFeatureReplacedByArchetype(g.name, classArchetypes)) {
        autoSuppressedFeatures.push({
          name: g.name,
          level: characterLevelIndex,
          reason: `replaced by archetype (${classArchetypes.map((archetype) => archetype.name).join(", ")})`,
        });
        continue;
      }
      autoGrantedFeatures.push({ name: g.name, level: characterLevelIndex });
    }

    const featureCtx = {
      armorCategory,
      loadBand: encumbrance.band,
      conditions: build.conditions ?? [],
    };
    for (const s of suppressedClassFeatures(granted, featureCtx)) {
      if (!replacedLabels.has(s.name.toLowerCase()))
        autoSuppressedFeatures.push({
          name: s.name,
          level: characterLevelIndex,
          reason: s.reason,
        });
    }

    if (lvl.modifiers) modifiers.push(...lvl.modifiers);
    if (lvl.feats)
      modifiers.push(
        ...featEffects(lvl.feats, featRegistry, build.levels.length),
      );
    modifiers.push(
      ...classFeatureEffects(
        granted.filter(
          (feature) =>
            !isFeatureReplacedByArchetype(feature.name, classArchetypes),
        ),
        featureCtx,
      ),
    );
    const isFavoredClassLevel =
      !!build.favoredClassName &&
      lvl.className.toLowerCase() === build.favoredClassName.toLowerCase();
    if (isFavoredClassLevel && lvl.favoredClass === "hp") {
      modifiers.push({
        target: "hp",
        type: "untyped",
        value: 1,
        source: "Favored class",
      });
    }
  }

  for (const [className, classLevel] of counts) {
    const classArchetypes = selectedArchetypesForClass(
      build,
      className,
      archetypeRegistry,
    );
    modifiers.push(
      ...archetypePassiveModifiers(
        { classLevel, wisdomMod: effectiveAbilityMod(build, "wis") },
        classArchetypes,
      ),
    );
  }
  modifiers.push(
    ...featEffects(
      autoGrantedFeats.map((feat) => feat.name),
      featRegistry,
      build.levels.length,
    ),
  );

  // Equipment: aggregate armor cap / check penalty / speed penalty.
  let maxDexBonus: number | undefined;
  let armorCheckPenalty = 0;
  for (const item of equippedEquipment(build.equipment)) {
    if (item.modifiers) modifiers.push(...item.modifiers);
    for (const reduction of item.damageReductions ?? []) {
      damageReductions.push({ ...reduction, source: item.name });
    }
    const armor = item.armor;
    if (armor) {
      if (armor.acBonus) {
        modifiers.push({
          target: "ac",
          type: "armor",
          value: armor.acBonus,
          source: `${item.name} (armor)`,
        });
      }
      if (
        armor.rangedTouchArmorFraction &&
        armor.acBonus &&
        armor.rangedTouchArmorFraction > 0
      ) {
        modifiers.push({
          target: "ac.touch.vs.ranged",
          type: "armor",
          value: Math.floor(armor.acBonus * armor.rangedTouchArmorFraction),
          source: `${item.name} (ranged touch defense)`,
        });
      }
      if (armor.maxDexBonus !== undefined) {
        maxDexBonus =
          maxDexBonus === undefined
            ? armor.maxDexBonus
            : Math.min(maxDexBonus, armor.maxDexBonus);
      }
      if (armor.checkPenalty) armorCheckPenalty += armor.checkPenalty;
      const baseRaceSpeed = activeRace.speed ?? 30;
      const profiledArmorSpeed =
        baseRaceSpeed >= 30 ? armor.speed30 : armor.speed20;
      const speedPenalty =
        profiledArmorSpeed !== undefined
          ? Math.max(0, baseRaceSpeed - profiledArmorSpeed)
          : (armor.speedPenalty ?? 0);
      if (speedPenalty > 0) {
        modifiers.push({
          target: "speed",
          type: "untyped",
          value: -speedPenalty,
          source: `${item.name} (armor)`,
        });
      }
    }
    const shield = item.shield;
    if (shield) {
      if (shield.acBonus) {
        modifiers.push({
          target: "ac",
          type: "shield",
          value: shield.acBonus,
          source: `${item.name} (shield)`,
        });
      }
      if (
        shield.rangedTouchShieldFraction &&
        shield.acBonus &&
        shield.rangedTouchShieldFraction > 0
      ) {
        modifiers.push({
          target: "ac.touch.vs.ranged",
          type: "shield",
          value: Math.floor(shield.acBonus * shield.rangedTouchShieldFraction),
          source: `${item.name} (ranged touch defense)`,
        });
      }
      if (shield.checkPenalty) armorCheckPenalty += shield.checkPenalty;
    }
  }
  if (build.otherModifiers) modifiers.push(...build.otherModifiers);

  // Skill ranks: sum allocations across levels.
  const skillRanks: Partial<Record<SkillKey, number>> = {};
  for (const lvl of build.levels) {
    if (!lvl.skillRanks) continue;
    for (const [key, ranks] of Object.entries(lvl.skillRanks) as [
      SkillKey,
      number,
    ][]) {
      skillRanks[key] = (skillRanks[key] ?? 0) + ranks;
    }
  }

  const buildWeapons = [
    ...(activeRace.grantedWeapons ?? []).map((weapon, index) => ({
      ...weapon,
      sourceKind: "race" as const,
      sourceIndex: index,
    })),
    ...equippedWeaponsFromEquipment(build.equipment),
    ...(build.weapons ?? []).map((weapon, index) => ({
      ...weapon,
      sourceKind: "build" as const,
      sourceIndex: index,
    })),
  ];
  const resolvedWeapons = buildWeapons.map((weapon) => ({
    ...weapon,
    proficient: isWeaponProficient(
      weapon,
      weaponProficiencies,
      specificWeaponProficiencies,
      build.campaignRules,
      activeRace.weaponFamiliarity,
    ),
  }));

  const rolledHitPoints = build.levels.map((l) => l.hitPointRoll);
  const hitPointDice = build.levels.reduce<
    Array<{
      className: string;
      hitDie: number;
      count: number;
      hpFromRolls: number;
    }>
  >((acc, lvl) => {
    const def = resolvedClassDefinition(
      registry,
      build,
      lvl.className,
      archetypeRegistry,
    );
    const className = def?.name ?? lvl.className;
    const hitDie = def?.hitDie ?? 0;
    const existing = acc.find(
      (entry) => entry.className === className && entry.hitDie === hitDie,
    );
    if (existing) {
      existing.count += 1;
      existing.hpFromRolls += lvl.hitPointRoll;
      return acc;
    }
    acc.push({ className, hitDie, count: 1, hpFromRolls: lvl.hitPointRoll });
    return acc;
  }, []);
  const favoredClassHpTotal = build.levels.reduce((sum, lvl) => {
    const isFavoredClassLevel =
      !!build.favoredClassName &&
      lvl.className.toLowerCase() === build.favoredClassName.toLowerCase();
    return sum + (isFavoredClassLevel && lvl.favoredClass === "hp" ? 1 : 0);
  }, 0);

  const spellcasting = [...counts.entries()].flatMap(([className, count]) => {
    const def = resolvedClassDefinition(
      registry,
      build,
      className,
      archetypeRegistry,
    );
    if (!def?.spellcasting) return [];
    const classArchetypes = selectedArchetypesForClass(
      build,
      def.name,
      archetypeRegistry,
    );
    const domainsEnabled =
      def.name.toLowerCase() === "cleric" &&
      !archetypeDisablesDomains(classArchetypes);
    const selectedDomains = domainsEnabled
      ? (
          build.spellDomains?.[className.toLowerCase()] ??
          build.spellDomains?.[def.name.toLowerCase()] ??
          []
        )
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];
    const specialistSchool =
      build.spellSpecializations?.[className.toLowerCase()] ??
      build.spellSpecializations?.[def.name.toLowerCase()];
    const manualExtraSlots =
      build.spellExtraSlots?.[className.toLowerCase()] ??
      build.spellExtraSlots?.[def.name.toLowerCase()] ??
      {};
    const autoDomainExtraSlotsRaw = domainsEnabled
      ? domainExtraSlots(selectedDomains)
      : {};
    const autoDomainExtraSlots: SpellExtraSlotsByLevel = {};
    const spellsPerDay = def.spellcasting.spellsPerDay[count] ?? {};
    for (const [levelKey, slots] of Object.entries(autoDomainExtraSlotsRaw)) {
      const level = Number(levelKey);
      const slotCount = typeof slots === "number" ? slots : 0;
      if ((spellsPerDay[level] ?? 0) > 0 && slotCount > 0)
        autoDomainExtraSlots[level] = slotCount;
    }
    const autoSchoolExtraSlotsRaw =
      def.name.toLowerCase() === "wizard"
        ? schoolExtraSlots(specialistSchool)
        : {};
    const autoSchoolExtraSlots: SpellExtraSlotsByLevel = {};
    for (const [levelKey, slots] of Object.entries(autoSchoolExtraSlotsRaw)) {
      const level = Number(levelKey);
      const slotCount = typeof slots === "number" ? slots : 0;
      if ((spellsPerDay[level] ?? 0) > 0 && slotCount > 0)
        autoSchoolExtraSlots[level] = slotCount;
    }
    const restrictedExtraSlots: SpellExtraSlotsByLevel = {};
    for (const levelKey of new Set([
      ...Object.keys(autoDomainExtraSlots),
      ...Object.keys(autoSchoolExtraSlots),
    ])) {
      const level = Number(levelKey);
      restrictedExtraSlots[level] =
        (autoDomainExtraSlots[level] ?? 0) + (autoSchoolExtraSlots[level] ?? 0);
    }
    const mergedExtraSlots: SpellExtraSlotsByLevel = {};
    for (const levelKey of new Set([
      ...Object.keys(restrictedExtraSlots),
      ...Object.keys(manualExtraSlots),
    ])) {
      const level = Number(levelKey);
      mergedExtraSlots[level] =
        (restrictedExtraSlots[level] ?? 0) + (manualExtraSlots[level] ?? 0);
    }
    return [
      {
        className: def.name,
        castingType: def.spellcasting.castingType,
        spellAccess: def.spellcasting.spellAccess,
        castingAbility: def.spellcasting.castingAbility,
        casterLevel: count,
        domains: selectedDomains,
        specialistSchool,
        spellsPerDay,
        spellsKnown: def.spellcasting.spellsKnown?.[count] ?? {},
        extraSlots: mergedExtraSlots,
        restrictedExtraSlots,
        grantedSpells: mergeSpellLibraries(
          domainsEnabled ? grantedDomainSpells(selectedDomains) : {},
          def.name.toLowerCase() === "wizard"
            ? grantedSchoolSpells(specialistSchool)
            : {},
        ),
        selections:
          build.spellSelections?.[className.toLowerCase()] ??
          build.spellSelections?.[def.name.toLowerCase()],
        library:
          build.spellLibrary?.[className.toLowerCase()] ??
          build.spellLibrary?.[def.name.toLowerCase()],
        slotsUsed:
          build.spellSlotUsage?.[className.toLowerCase()] ??
          build.spellSlotUsage?.[def.name.toLowerCase()],
      },
    ];
  });

  // Descriptor: race, class breakdown, and feats/features with the level gained.
  const feats: NamedAcquisition[] = [...autoGrantedFeats];
  const archetypes: NamedAcquisition[] = [...autoGrantedArchetypes];
  const features: NamedAcquisition[] = [...autoGrantedFeatures];

  build.levels.forEach((lvl, index) => {
    const levelNum = index + 1;
    for (const feat of lvl.feats ?? [])
      feats.push({ name: feat, level: levelNum });
    if (levelNum === 1) {
      for (const feat of raceBonusFeatNames(activeRace))
        feats.push({ name: feat, level: levelNum });
    }
    for (const feature of lvl.features ?? [])
      features.push({ name: feature, level: levelNum });
  });
  const classes: NamedAcquisition[] = [];
  for (const [className, count] of counts) {
    const def = resolvedClassDefinition(
      registry,
      build,
      className,
      archetypeRegistry,
    );
    classes.push({ name: def?.name ?? className, level: count });
  }
  const dedupeAcquisitions = (
    items: NamedAcquisition[],
  ): NamedAcquisition[] => {
    const seen = new Set<string>();
    const out: NamedAcquisition[] = [];
    for (const item of items) {
      const key = `${item.level}::${item.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };
  const dedupeFeatAcquisitions = (
    items: NamedAcquisition[],
  ): NamedAcquisition[] => {
    const seen = new Set<string>();
    const out: NamedAcquisition[] = [];
    for (const item of items) {
      const parsed = parseFeatSelection(featRegistry, item.name);
      if (parsed?.feat.repeatable && !parsed.feat.parameter) {
        out.push(item);
        continue;
      }
      const key = `${item.level}::${item.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };
  const dedupeSuppressed = (
    items: SuppressedAcquisition[],
  ): SuppressedAcquisition[] => {
    const seen = new Set<string>();
    const out: SuppressedAcquisition[] = [];
    for (const item of items) {
      const key = `${item.level}::${item.name.toLowerCase()}::${item.reason.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };
  const descriptor: SheetDescriptor = {
    race: activeRace.name,
    alignment: build.alignment,
    classes,
    archetypes: dedupeAcquisitions(archetypes),
    feats: dedupeFeatAcquisitions(feats),
    features: dedupeAcquisitions(features),
    suppressedFeatures: dedupeSuppressed(autoSuppressedFeatures),
  };

  return {
    raceMetadata: {
      movementModes: activeRace.movementModes,
      senses: activeRace.senses,
      resistances: activeRace.resistances,
      ferocity: activeRace.ferocity,
      favoredClassBonuses: activeRace.favoredClassBonuses,
      weaponFamiliarity: activeRace.weaponFamiliarity,
      notes: [...(activeRace.notes ?? []), ...raceChoiceNotes(activeRace)],
    },
    descriptor,
    name: build.name,
    level,
    size: activeRace.size,
    abilityScores: effectiveBaseScores(build),
    baseAttackBonus,
    baseSaves,
    armorCategory,
    carriedWeight,
    ignoreEncumbrance,
    inventory: equipmentInventory,
    inventoryItems: equipmentInventoryItems,
    maxDexBonus,
    armorCheckPenalty: armorCheckPenalty || undefined,
    baseSpeed: activeRace.speed ?? 30,
    rolledHitPoints,
    hitPointDetails: {
      dice: hitPointDice,
      rolledHpTotal: rolledHitPoints.reduce((sum, value) => sum + value, 0),
      constitutionBonusTotal: 0,
      favoredClassHpTotal,
      miscHpTotal: 0,
    },
    classSkills: [...classSkillSet],
    skillRanks,
    skillUsableOverrides,
    weaponDamageAbilityOverrides: weaponDamageAbilityOverridesForBuild(build),
    weapons: resolvedWeapons,
    spellcasting,
    damageReductions,
    modifiers,
  };
}

/**
 * Validate a build against the rules we can check without a full content DB:
 *   - every class taken must exist in the registry
 *   - ability increases only at levels 4, 8, 12, ...
 *   - per-skill total ranks may not exceed character level
 *   - per-level skill-point budget (soft warning)
 */
export function validateBuild(
  build: CharacterBuild,
  registry: ClassRegistry = SAMPLE_CLASSES,
  spellRegistry: SpellRegistry = SPELLS,
  archetypeRegistry?: ArchetypeRegistry,
  featRegistry: FeatRegistry = FEATS,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const characterLevel = build.levels.length;
  const activeRace = resolveRaceChoice(build.race);

  const effInt =
    effectiveBaseScores(build).int +
    sumRacialAbility(raceAbilityModifiers(activeRace), "int");
  const intMod = abilityModifier(effInt);

  const runningRanks: Partial<Record<SkillKey, number>> = {};
  const flexibleAbilityBonus = activeRace.choiceOptions?.flexibleAbilityBonus;
  if (flexibleAbilityBonus) {
    const selectedAbility = build.race.choiceSelection?.flexibleAbility;
    const allowedAbilities = flexibleAbilityBonus.abilities ?? [
      "str",
      "dex",
      "con",
      "int",
      "wis",
      "cha",
    ];
    if (!selectedAbility) {
      issues.push({
        severity: "warning",
        code: "race-flexible-ability-unselected",
        message: `${activeRace.name} grants a flexible racial ability bonus that has not been assigned.`,
      });
    } else if (!allowedAbilities.includes(selectedAbility)) {
      issues.push({
        severity: "error",
        code: "race-flexible-ability-invalid",
        message: `${activeRace.name} cannot assign its flexible racial bonus to ${selectedAbility.toUpperCase()}.`,
      });
    }
  }
  const raceBonusFeatOption = activeRace.choiceOptions?.bonusFeat;
  if (raceBonusFeatOption) {
    const selectedFeat = build.race.choiceSelection?.bonusFeat?.trim();
    if (!selectedFeat) {
      issues.push({
        severity: "warning",
        code: "race-bonus-feat-unselected",
        message: `${activeRace.name} grants a bonus feat that has not been chosen.`,
      });
    } else if (
      (raceBonusFeatOption.featOptions?.length ?? 0) > 0 &&
      !raceBonusFeatOption.featOptions?.some(
        (feat) => feat.toLowerCase() === selectedFeat.toLowerCase(),
      )
    ) {
      issues.push({
        severity: "error",
        code: "race-bonus-feat-invalid",
        message: `${activeRace.name} cannot take "${selectedFeat}" as its racial bonus feat.`,
      });
    }
  }
  const selectedAlternateTraits =
    build.race.choiceSelection?.alternateTraits ?? [];
  const seenAlternateTraits = new Set<string>();
  const replacedBaseTraits = new Map<string, string>();
  for (const altId of selectedAlternateTraits) {
    const alt = build.race.alternateTraits?.find(
      (trait) => trait.id.toLowerCase() === altId.toLowerCase(),
    );
    if (!alt) {
      issues.push({
        severity: "error",
        code: "unknown-race-alternate-trait",
        message: `${build.race.name} does not have alternate racial trait "${altId}".`,
      });
      continue;
    }
    if (seenAlternateTraits.has(alt.id.toLowerCase())) {
      issues.push({
        severity: "error",
        code: "duplicate-race-alternate-trait",
        message: `${build.race.name} selected alternate racial trait "${alt.name}" more than once.`,
      });
      continue;
    }
    seenAlternateTraits.add(alt.id.toLowerCase());
    for (const replaced of alt.replaces ?? []) {
      const prior = replacedBaseTraits.get(replaced.toLowerCase());
      if (prior) {
        issues.push({
          severity: "error",
          code: "race-alternate-trait-conflict",
          message: `${build.race.name} selected alternate racial traits that both replace "${replaced}" (${prior} and ${alt.name}).`,
        });
      } else {
        replacedBaseTraits.set(replaced.toLowerCase(), alt.name);
      }
    }
  }
  const classCounts = classLevelCounts(build);
  if (archetypeRegistry) {
    for (const [classKey, archetypeIds] of Object.entries(
      build.classArchetypes ?? {},
    )) {
      const normalizedClassKey = classKey.trim().toLowerCase();
      if (!normalizedClassKey) continue;
      if (!classCounts.has(normalizedClassKey)) {
        issues.push({
          severity: "warning",
          code: "archetype-class-not-in-build",
          message: `Archetypes are selected for class "${classKey}", but the build has no levels in that class.`,
        });
      }
      const seenIds = new Set<string>();
      const selectedArchetypes: ArchetypeDefinitionLike[] = [];
      for (const rawId of archetypeIds ?? []) {
        const normalizedId = rawId.trim().toLowerCase();
        if (!normalizedId) continue;
        const archetype = archetypeRegistry[normalizedId];
        if (!archetype) {
          issues.push({
            severity: "error",
            code: "unknown-archetype",
            message: `Unknown archetype "${rawId}" is selected for class "${classKey}".`,
          });
          continue;
        }
        if (seenIds.has(normalizedId)) {
          issues.push({
            severity: "error",
            code: "duplicate-archetype",
            message: `Archetype "${archetype.name}" is selected more than once for class "${classKey}".`,
          });
          continue;
        }
        seenIds.add(normalizedId);
        if (
          archetype.baseClassName.trim().toLowerCase() !== normalizedClassKey
        ) {
          issues.push({
            severity: "error",
            code: "archetype-wrong-base-class",
            message: `Archetype "${archetype.name}" applies to ${archetype.baseClassName}, not ${classKey}.`,
          });
          continue;
        }
        selectedArchetypes.push(archetype);
      }
      const claimedBuckets = new Map<string, string>();
      for (const archetype of selectedArchetypes) {
        for (const bucket of archetypeFeatureBuckets(archetype)) {
          const prior = claimedBuckets.get(bucket);
          if (prior) {
            issues.push({
              severity: "error",
              code: "archetype-feature-conflict",
              message: `Archetypes "${prior}" and "${archetype.name}" both modify/replace "${bucket}" for ${classKey}.`,
            });
          } else {
            claimedBuckets.set(bucket, archetype.name);
          }
        }
      }
    }
  }
  const armorProficiencies = new Set<"light" | "medium" | "heavy">();
  const shieldProficiencies = new Set<"shield" | "tower-shield">();
  const weaponProficiencies = new Set<"simple" | "martial" | "exotic">(
    activeRace.weaponProficiencies ?? [],
  );
  const specificWeaponProficiencies = new Set<string>(
    (activeRace.specificWeaponProficiencies ?? []).map((weaponName) =>
      normalizeWeaponName(weaponName),
    ),
  );
  for (const className of classCounts.keys()) {
    const def = resolvedClassDefinition(
      registry,
      build,
      className,
      archetypeRegistry,
    );
    for (const armor of def?.armorProficiencies ?? [])
      armorProficiencies.add(armor);
    for (const shield of def?.shieldProficiencies ?? [])
      shieldProficiencies.add(shield);
    for (const weapon of def?.weaponProficiencies ?? [])
      weaponProficiencies.add(weapon);
    for (const weaponName of def?.specificWeaponProficiencies ?? []) {
      specificWeaponProficiencies.add(normalizeWeaponName(weaponName));
    }
  }

  const runningClassLevels = new Map<string, number>();
  const chosenFeatSelections = [...raceBonusFeatNames(activeRace)];

  build.levels.forEach((lvl, index) => {
    const levelNum = index + 1;
    const def = resolvedClassDefinition(
      registry,
      build,
      lvl.className,
      archetypeRegistry,
    );

    if (!def) {
      issues.push({
        severity: "error",
        code: "unknown-class",
        level: levelNum,
        message: `Unknown class "${lvl.className}" at level ${levelNum}.`,
      });
    } else if (
      !classAllowsAlignment(def, build.alignment, build.campaignRules)
    ) {
      issues.push({
        severity: "error",
        code: "class-alignment-restriction",
        level: levelNum,
        message: `Level ${levelNum}: ${def.alignmentRestriction?.description ?? `${def.name} does not allow this alignment.`}`,
      });
    } else if (
      !Number.isInteger(lvl.hitPointRoll) ||
      lvl.hitPointRoll < 1 ||
      lvl.hitPointRoll > def.hitDie
    ) {
      issues.push({
        severity: "error",
        code: "invalid-hit-point-roll",
        level: levelNum,
        message: `Level ${levelNum}: HP roll ${lvl.hitPointRoll} must be a whole number from 1 to d${def.hitDie} for ${def.name}.`,
      });
    }

    const priorClassLevels =
      runningClassLevels.get(lvl.className.toLowerCase()) ?? 0;
    if (def?.isPrestigeClass && priorClassLevels === 0) {
      const prefixBuild = { ...build, levels: build.levels.slice(0, index) };
      const prefixSheet = computeSheet(
        buildCharacter(
          prefixBuild,
          registry,
          featRegistry,
          undefined,
          archetypeRegistry,
        ),
      );
      const classPrereqs = checkClassPrerequisites(def, {
        ...featContextFromSheet(prefixSheet),
        skillRanks: { ...runningRanks },
        classLevels: new Map(runningClassLevels),
      });
      if (classPrereqs.length > 0) {
        issues.push({
          severity: "error",
          code: "prestige-class-prerequisites",
          level: levelNum,
          message: `${lvl.className} prerequisites not met at level ${levelNum}: ${classPrereqs.map((prereq) => prereq.description).join(", ")}.`,
        });
      }
    }

    if (lvl.abilityIncrease && levelNum % 4 !== 0) {
      issues.push({
        severity: "error",
        code: "illegal-ability-increase",
        level: levelNum,
        message: `Ability score increase at level ${levelNum}; allowed only at levels 4, 8, 12, ...`,
      });
    }

    if (lvl.favoredClass) {
      const isFavoredClassLevel =
        !!build.favoredClassName &&
        lvl.className.toLowerCase() === build.favoredClassName.toLowerCase();
      if (!isFavoredClassLevel) {
        issues.push({
          severity: "warning",
          code: "favored-class-bonus-ineligible",
          level: levelNum,
          message: `Level ${levelNum}: ${lvl.className} is not the selected favored class, so its favored-class bonus does not apply.`,
        });
      }
      if (
        lvl.favoredClass !== "hp" &&
        lvl.favoredClass !== "skill" &&
        !favoredClassBonusOptions(activeRace, lvl.className).some(
          (bonus) => bonus.id === lvl.favoredClass,
        )
      ) {
        issues.push({
          severity: "error",
          code: "unknown-favored-class-bonus",
          level: levelNum,
          message: `Level ${levelNum}: favored-class bonus "${lvl.favoredClass}" is not available to ${activeRace.name} ${lvl.className}.`,
        });
      }
    }

    // Per-level skill-point budget (soft check).
    if (def && lvl.skillRanks) {
      const spent = Object.values(lvl.skillRanks).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      const isFavoredClassLevel =
        !!build.favoredClassName &&
        lvl.className.toLowerCase() === build.favoredClassName.toLowerCase();
      const favoredSkill =
        isFavoredClassLevel && lvl.favoredClass === "skill" ? 1 : 0;
      const budget =
        Math.max(1, def.skillRanksPerLevel + intMod) +
        favoredSkill +
        raceExtraSkillRanksPerLevel(activeRace);
      if (spent > budget) {
        issues.push({
          severity: "warning",
          code: "skill-points-over-budget",
          level: levelNum,
          message: `Level ${levelNum}: allocated ${spent} skill ranks but budget is ~${budget}.`,
        });
      }
    }

    if (lvl.feats?.length) {
      const currentBuild = {
        ...build,
        levels: build.levels.slice(0, index + 1),
      };
      const currentSheet = computeSheet(
        buildCharacter(
          currentBuild,
          registry,
          featRegistry,
          undefined,
          archetypeRegistry,
        ),
      );
      let featContext = {
        ...featContextFromSheet(currentSheet),
        featNames: [...chosenFeatSelections],
      };
      for (const featSelection of lvl.feats) {
        const parsed = parseFeatSelection(featRegistry, featSelection);
        if (!parsed) {
          issues.push({
            severity: "error",
            code: "unknown-feat",
            level: levelNum,
            message: `Unknown feat "${featSelection}" at level ${levelNum}.`,
          });
          continue;
        }
        if (parsed.feat.parameter && !parsed.parameterValue) {
          issues.push({
            severity: "error",
            code: "feat-parameter-missing",
            level: levelNum,
            message: `${parsed.feat.name} at level ${levelNum} requires a ${parsed.feat.parameter.label.toLowerCase()} choice.`,
          });
          continue;
        }
        if (
          parsed.parameterValue &&
          parsed.feat.parameter &&
          parsed.feat.parameter.kind !== "weapon" &&
          !featParameterOptions(parsed.feat).some(
            (option) =>
              option.toLowerCase() === parsed.parameterValue?.toLowerCase(),
          )
        ) {
          issues.push({
            severity: "error",
            code: "feat-parameter-invalid",
            level: levelNum,
            message: `${parsed.selectionName} uses an invalid ${parsed.feat.parameter.label.toLowerCase()} choice.`,
          });
          continue;
        }
        const duplicate = parsed.feat.repeatable
          ? !!parsed.feat.parameter &&
            chosenFeatSelections.some(
              (selection) =>
                selection.toLowerCase() === featSelection.toLowerCase(),
            )
          : chosenFeatSelections.some(
              (selection) =>
                featSelectionBaseName(selection) ===
                parsed.feat.name.toLowerCase(),
            );
        if (duplicate) {
          issues.push({
            severity: "error",
            code: "duplicate-feat",
            level: levelNum,
            message: `${parsed.selectionName} is selected more than once.`,
          });
          continue;
        }
        const prereq = checkPrerequisites(
          parsed.feat,
          featContext,
          parsed.parameterValue,
        );
        if (!prereq.met) {
          issues.push({
            severity: "error",
            code: "feat-prerequisites",
            level: levelNum,
            message: `${parsed.selectionName} prerequisites not met at level ${levelNum}: ${prereq.unmet.map((entry) => entry.description).join(", ")}.`,
          });
          continue;
        }
        chosenFeatSelections.push(parsed.selectionName);
        featContext = { ...featContext, featNames: [...chosenFeatSelections] };
      }
    }

    // Per-skill rank cap = character level.
    if (lvl.skillRanks) {
      for (const [key, ranks] of Object.entries(lvl.skillRanks) as [
        SkillKey,
        number,
      ][]) {
        runningRanks[key] = (runningRanks[key] ?? 0) + ranks;
        if ((runningRanks[key] ?? 0) > levelNum) {
          issues.push({
            severity: "error",
            code: "skill-ranks-over-cap",
            level: levelNum,
            message: `Skill "${key}" has ${runningRanks[key]} ranks at level ${levelNum}; max is ${levelNum}.`,
          });
        }
      }
    }
    runningClassLevels.set(lvl.className.toLowerCase(), priorClassLevels + 1);
  });

  // Final-state cap check against full character level (covers spread-out ranks).
  for (const [key, ranks] of Object.entries(runningRanks) as [
    SkillKey,
    number,
  ][]) {
    if ((ranks ?? 0) > characterLevel) {
      issues.push({
        severity: "error",
        code: "skill-ranks-over-cap",
        message: `Skill "${key}" totals ${ranks} ranks; character level is ${characterLevel}.`,
      });
    }
  }

  const equippedArmor = equippedArmorEntries(build.equipment);
  for (const item of equippedArmor) {
    const category = item.armor?.category;
    if (category && !armorProficiencies.has(category)) {
      issues.push({
        severity: "warning",
        code: "nonproficient-armor",
        message: `Equipped armor "${item.name}" is ${category} armor, but this build lacks ${category} armor proficiency.`,
      });
    }
  }
  for (const item of equippedShieldEntries(build.equipment)) {
    if (!shieldProficiencies.has("shield")) {
      issues.push({
        severity: "warning",
        code: "nonproficient-shield",
        message: `Equipped shield "${item.name}" requires shield proficiency, but this build lacks it.`,
      });
    }
  }
  for (const weapon of [
    ...(activeRace.grantedWeapons ?? []),
    ...equippedWeaponsFromEquipment(build.equipment),
    ...(build.weapons ?? []),
  ]) {
    if (
      !isWeaponProficient(
        weapon,
        weaponProficiencies,
        specificWeaponProficiencies,
        build.campaignRules,
        activeRace.weaponFamiliarity,
      )
    ) {
      const effectiveGroup = effectiveWeaponGroupForBuild(
        weapon,
        build.campaignRules,
        activeRace.weaponFamiliarity,
      );
      const groupLabel = effectiveGroup ? `${effectiveGroup} ` : "";
      issues.push({
        severity: "warning",
        code: "nonproficient-weapon",
        message: `Weapon "${weapon.name}" is ${groupLabel}weapon the build is not proficient with.`,
      });
    }
  }
  if (equippedArmor.length > 1) {
    issues.push({
      severity: "error",
      code: "multiple-equipped-armor",
      message: `Multiple armor entries are equipped (${equippedArmor.map((item) => item.name).join(", ")}). Wear one suit at a time.`,
    });
  }
  const equippedSlotCounts = new Map<EquipmentSlot, number>();
  for (const item of equippedEquipment(build.equipment)) {
    if (!item.slot) continue;
    equippedSlotCounts.set(
      item.slot,
      (equippedSlotCounts.get(item.slot) ?? 0) + 1,
    );
  }
  for (const [slot, count] of equippedSlotCounts) {
    const capacity = EQUIPMENT_SLOT_CAPACITY[slot];
    if (count > capacity) {
      issues.push({
        severity: "error",
        code: "equipment-slot-conflict",
        message: `Equipped items exceed ${slot} slot capacity (${count}/${capacity}).`,
      });
    }
  }
  const purse = coinCount(build.coinPurse);
  for (const [denomination, amount] of Object.entries(purse)) {
    if (denomination === "total") continue;
    if (!Number.isInteger(amount) || amount < 0) {
      issues.push({
        severity: "error",
        code: "invalid-coin-count",
        message: `Coin count for ${denomination.toUpperCase()} must be a non-negative whole number.`,
      });
    }
  }
  const wishlistCost = wishlistCostGp(build.equipment);
  const liquidWealth = liquidWealthGp(build.coinPurse);
  if (wishlistCost > liquidWealth) {
    issues.push({
      severity: "warning",
      code: "wishlist-over-budget",
      message: `Wishlist costs ${wishlistCost.toFixed(2)} gp, but only ${liquidWealth.toFixed(2)} gp is available in the coin purse.`,
    });
  }
  const containerAnalysis = analyzeContainers(build.equipment);
  for (const name of containerAnalysis.duplicateNames) {
    issues.push({
      severity: "warning",
      code: "duplicate-container-name",
      message: `Multiple containers are named "${name}". Rename them so container assignments are unambiguous.`,
    });
  }
  for (const item of containerAnalysis.missingAssignments) {
    issues.push({
      severity: "warning",
      code: "missing-container-reference",
      message: `Equipment item "${item.name}" references missing container "${item.containerName?.trim()}".`,
    });
  }
  for (const item of containerAnalysis.selfAssignments) {
    issues.push({
      severity: "error",
      code: "self-contained-item",
      message: `Equipment item "${item.name}" cannot list itself as its own container.`,
    });
  }
  for (const entry of containerAnalysis.overloaded) {
    issues.push({
      severity: "warning",
      code: "container-over-capacity",
      message: `Container "${entry.name}" holds ${entry.contentsWeightLb.toFixed(2)} lb but is only rated for ${Number(entry.capacityLb ?? 0).toFixed(2)} lb.`,
    });
  }

  for (const item of build.equipment ?? []) {
    const quantity = item.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      issues.push({
        severity: "error",
        code: "invalid-equipment-quantity",
        message: `Equipment item "${item.name}" must have a positive whole-number quantity.`,
      });
    }
    if ((item.weight ?? 0) < 0) {
      issues.push({
        severity: "error",
        code: "invalid-equipment-weight",
        message: `Equipment item "${item.name}" cannot have negative weight.`,
      });
    }
    if ((item.costGp ?? 0) < 0) {
      issues.push({
        severity: "error",
        code: "invalid-equipment-cost",
        message: `Equipment item "${item.name}" cannot have negative cost.`,
      });
    }
    if (item.slot && !EQUIPMENT_SLOTS.includes(item.slot)) {
      issues.push({
        severity: "error",
        code: "unknown-equipment-slot",
        message: `Equipment item "${item.name}" uses unknown slot "${item.slot}".`,
      });
    }
    if (
      equipmentOwnership(item) === "wishlist" &&
      (item.equipped || (item.carryState && item.carryState !== "cached"))
    ) {
      issues.push({
        severity: "warning",
        code: "wishlist-item-active",
        message: `Wishlist item "${item.name}" is marked as active gear. Wishlist entries should stay uncached dreams, not equipped reality.`,
      });
    }
    if (
      item.equipped &&
      item.slot &&
      item.slot !== "slotless" &&
      quantity > 1
    ) {
      issues.push({
        severity: "error",
        code: "equipped-slotted-item-quantity-over-one",
        message: `Equipped slotted item "${item.name}" has quantity ${quantity}; equipped slotted entries should represent one worn item.`,
      });
    }
    if (item.equipped && item.armor && quantity > 1) {
      issues.push({
        severity: "error",
        code: "equipped-armor-quantity-over-one",
        message: `Armor item "${item.name}" is equipped with quantity ${quantity}; armor entries should represent one worn suit.`,
      });
    }
  }

  for (const entry of effectiveSpellcastingSelections(
    build,
    registry,
    archetypeRegistry,
  )) {
    if (entry.className.toLowerCase() === "cleric") {
      const domainIds = entry.domains.filter((id) => id.trim().length > 0);
      const unique = new Set(domainIds.map((id) => id.toLowerCase()));
      for (const id of domainIds) {
        if (!getDomain(id)) {
          issues.push({
            severity: "error",
            code: "unknown-domain",
            message: `Unknown cleric domain "${id}".`,
          });
        }
      }
      if (domainIds.length !== unique.size) {
        issues.push({
          severity: "error",
          code: "duplicate-domain",
          message: "Cleric domains must be distinct.",
        });
      }
      if (domainIds.length > 0 && domainIds.length !== 2) {
        issues.push({
          severity: "warning",
          code: "cleric-domains-incomplete",
          message: `Cleric has ${domainIds.length} domain selection(s); expected 2.`,
        });
      }
    }
    if (
      entry.className.toLowerCase() === "wizard" &&
      entry.specialistSchool &&
      !getSchool(entry.specialistSchool)
    ) {
      issues.push({
        severity: "error",
        code: "unknown-specialist-school",
        message: `Unknown wizard specialist school "${entry.specialistSchool}".`,
      });
    }
    const library = build.spellLibrary?.[entry.className.toLowerCase()] ?? {};
    const grantedSpells = entry.grantedSpells ?? {};
    const validateSelectedSpell = (
      spellName: string,
      className: string,
      spellLevel: number,
    ) => {
      const spell = getSpell(spellRegistry, spellName);
      if (!spell) {
        issues.push({
          severity: "error",
          code: "unknown-spell",
          message: `Unknown spell "${spellName}" selected for ${className}.`,
        });
        return;
      }
      const actualLevel = classSpellLevel(spell, className);
      if (actualLevel === undefined) {
        issues.push({
          severity: "error",
          code: "spell-not-on-class-list",
          message: `${className} cannot select "${spellName}" because it is not on that class list.`,
        });
        return;
      }
      if (actualLevel !== spellLevel) {
        issues.push({
          severity: "error",
          code: "spell-level-mismatch",
          message: `${className} selected "${spellName}" as level ${spellLevel}, but it is level ${actualLevel}.`,
        });
      }
      const manualLibraryNames = library[spellLevel] ?? [];
      const grantedLibraryNames = grantedSpells[spellLevel] ?? [];
      const libraryNames = [...manualLibraryNames, ...grantedLibraryNames];
      const automaticallyAvailable =
        entry.spellAccess === "full-list" &&
        (entry.spellsPerDay[spellLevel] ?? -1) >= 0 &&
        actualLevel === spellLevel;
      if (
        !automaticallyAvailable &&
        manualLibraryNames.length > 0 &&
        !libraryNames.some(
          (name) => name.toLowerCase() === spellName.toLowerCase(),
        )
      ) {
        issues.push({
          severity: "error",
          code: "spell-not-in-library",
          message: `${className} selected "${spellName}" at level ${spellLevel}, but it is not in that class library/pool.`,
        });
      }
    };

    for (const [spellLevelStr, names] of Object.entries(library)) {
      const spellLevel = Number(spellLevelStr);
      for (const spellName of names ?? []) {
        validateSelectedSpell(spellName, entry.className, spellLevel);
      }
    }

    const prepared = entry.selections?.prepared ?? {};
    for (const [spellLevelStr, names] of Object.entries(prepared)) {
      const spellLevel = Number(spellLevelStr);
      const selectedNames = names ?? [];
      const selectedCount = selectedNames.length;
      const baseSlots = entry.spellsPerDay[spellLevel] ?? 0;
      const extraSlots = entry.extraSlots[spellLevel] ?? 0;
      const restrictedExtraSlots = entry.restrictedExtraSlots[spellLevel] ?? 0;
      const canCastLevel = canCastSpellLevel(
        entry.castingAbilityScore,
        spellLevel,
      );
      const capacity = canCastLevel
        ? baseSlots +
          ((entry.spellsPerDay[spellLevel] ?? -1) >= 0
            ? bonusSpellSlotsForLevel(entry.castingAbilityMod, spellLevel)
            : 0) +
          extraSlots
        : 0;
      if (!canCastLevel && selectedCount > 0) {
        issues.push({
          severity: "error",
          code: "spell-level-ability-gated",
          message: `${entry.className} selected level ${spellLevel} spells but lacks the casting ability score to cast them.`,
        });
      }
      if (selectedCount > capacity) {
        issues.push({
          severity: "error",
          code: "prepared-spells-over-capacity",
          message: `${entry.className} prepared ${selectedCount} level ${spellLevel} spells but capacity is ${capacity}.`,
        });
      }
      const grantedNames = grantedSpells[spellLevel] ?? [];
      const eligibleRestrictedCount = selectedNames.filter((spellName) =>
        grantedNames.some(
          (name) => name.toLowerCase() === spellName.toLowerCase(),
        ),
      ).length;
      const unrestrictedCapacity = Math.max(0, capacity - restrictedExtraSlots);
      const restrictedShortfall = Math.max(
        0,
        selectedCount - unrestrictedCapacity - eligibleRestrictedCount,
      );
      if (restrictedShortfall > 0) {
        issues.push({
          severity: "error",
          code: "prepared-spells-miss-restricted-slots",
          message: `${entry.className} prepared ${selectedCount} level ${spellLevel} spells, but ${restrictedExtraSlots} restricted slot(s) require granted school/domain spells.`,
        });
      }
      for (const spellName of selectedNames) {
        validateSelectedSpell(spellName, entry.className, spellLevel);
      }
    }

    const known = entry.selections?.known ?? {};
    for (const [spellLevelStr, names] of Object.entries(known)) {
      const spellLevel = Number(spellLevelStr);
      const selectedNames = names ?? [];
      const selectedCount = selectedNames.length;
      const cap = entry.spellsKnown[spellLevel] ?? 0;
      if (selectedCount > cap) {
        issues.push({
          severity: "error",
          code: "spells-known-over-cap",
          message: `${entry.className} selected ${selectedCount} known level ${spellLevel} spells but cap is ${cap}.`,
        });
      }
      for (const spellName of selectedNames) {
        validateSelectedSpell(spellName, entry.className, spellLevel);
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Level-up planning: what choices does the NEXT level grant the player?
// ---------------------------------------------------------------------------

function effectiveAbilityScore(
  build: CharacterBuild,
  ability: AbilityKey,
): number {
  const activeRace = resolveRaceChoice(build.race);
  return (
    effectiveBaseScores(build)[ability] +
    sumRacialAbility(raceAbilityModifiers(activeRace), ability)
  );
}

function effectiveAbilityMod(
  build: CharacterBuild,
  ability: AbilityKey,
): number {
  return abilityModifier(effectiveAbilityScore(build, ability));
}

function featSlotsForClassLevel(
  build: CharacterBuild,
  className: string,
): FeatGrantSlot[] {
  const slots: FeatGrantSlot[] = [];
  const normalizedClass = className.trim().toLowerCase();
  const characterLevel = build.levels.length + 1;
  if (characterLevel % 2 === 1) {
    slots.push({
      kind: "general",
      label: "Character feat",
      source: `Level ${characterLevel}`,
    });
  }
  const nextClassLevel =
    (classLevelCounts(build).get(normalizedClass) ?? 0) + 1;
  const classBonusSlot = classBonusFeatSlot(className, nextClassLevel);
  if (classBonusSlot) slots.push(classBonusSlot);
  return slots;
}

/** Compute the choices the next level in `className` offers. Pure. */
export function planLevelUp(
  build: CharacterBuild,
  className: string,
  registry: ClassRegistry = SAMPLE_CLASSES,
  archetypeRegistry?: ArchetypeRegistry,
): LevelUpPlan {
  const def = resolvedClassDefinition(
    registry,
    build,
    className,
    archetypeRegistry,
  );
  if (!def) throw new Error(`Unknown class "${className}"`);

  const activeRace = resolveRaceChoice(build.race);
  const characterLevel = build.levels.length + 1;
  const featSlots = featSlotsForClassLevel(build, def.name);
  const skillPoints =
    Math.max(1, def.skillRanksPerLevel + effectiveAbilityMod(build, "int")) +
    raceExtraSkillRanksPerLevel(activeRace);

  const classSkillSet = new Set<SkillKey>(activeRace.classSkills ?? []);
  for (const existing of classLevelCounts(build).keys()) {
    const d = resolvedClassDefinition(
      registry,
      build,
      existing,
      archetypeRegistry,
    );
    if (d) for (const s of d.classSkills) classSkillSet.add(s);
  }
  for (const s of def.classSkills) classSkillSet.add(s);

  return {
    characterLevel,
    className: def.name,
    hitDie: def.hitDie,
    averageHitPoints: Math.floor(def.hitDie / 2) + 1,
    skillPoints,
    maxRanksPerSkill: characterLevel,
    grantsFeat: featSlots.length > 0,
    featSlots,
    grantsAbilityIncrease: characterLevel % 4 === 0,
    classSkills: [...classSkillSet],
  };
}

export function createPreLevelBuild(
  build: CharacterBuild,
  selection: PreLevelBuildSelection,
  registry: ClassRegistry = SAMPLE_CLASSES,
  archetypeRegistry?: ArchetypeRegistry,
): PreLevelBuildResult {
  const plan = planLevelUp(
    build,
    selection.className,
    registry,
    archetypeRegistry,
  );
  const normalizedSelection: LevelUpSelection = {
    className: selection.className,
    hitPointRoll: selection.hitPointRoll ?? plan.averageHitPoints,
    skillRanks: selection.skillRanks ?? {},
    feats: selection.feats?.filter((feat) => feat.trim().length > 0),
    abilityIncrease: selection.abilityIncrease,
    favoredClass: selection.favoredClass,
    favoredClassSelection: selection.favoredClassSelection,
  };
  const next = applyLevelUp(build, normalizedSelection);
  const definition = resolvedClassDefinition(
    registry,
    next,
    selection.className,
    archetypeRegistry,
  )!;
  const favoredSkill =
    selection.favoredClass === "skill" &&
    build.favoredClassName?.toLowerCase() === definition.name.toLowerCase()
      ? 1
      : 0;
  return {
    plan: {
      ...plan,
      skillPoints:
        Math.max(
          1,
          definition.skillRanksPerLevel + effectiveAbilityMod(next, "int"),
        ) +
        raceExtraSkillRanksPerLevel(resolveRaceChoice(next.race)) +
        favoredSkill,
    },
    selection: normalizedSelection,
    build: next,
  };
}

/** Apply a level-up selection, returning a NEW build. */
export function applyLevelUp(
  build: CharacterBuild,
  selection: LevelUpSelection,
): CharacterBuild {
  return levelUp(build, {
    className: selection.className,
    hitPointRoll: selection.hitPointRoll,
    skillRanks: selection.skillRanks,
    feats: selection.feats,
    abilityIncrease: selection.abilityIncrease,
    favoredClass: selection.favoredClass,
    favoredClassSelection: selection.favoredClassSelection,
  });
}

function sumRacialAbility(
  mods: Modifier[] | undefined,
  ability: AbilityKey,
): number {
  if (!mods) return 0;
  return mods
    .filter((m) => m.target === ability)
    .reduce((sum, m) => sum + m.value, 0);
}
