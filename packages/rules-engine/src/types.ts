/**
 * Core domain types for the Pathfinder 1e rules engine.
 *
 * The engine is a PURE function: given a normalized character (base data + a
 * flat list of modifiers) it derives a complete sheet. Feats, gear, class
 * features, conditions, auras, and group buffs ALL funnel into one uniform
 * `Modifier` stream. That is the whole trick.
 */

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type AbilityScores = Record<AbilityKey, number>;

export type Size =
  | "fine"
  | "diminutive"
  | "tiny"
  | "small"
  | "medium"
  | "large"
  | "huge"
  | "gargantuan"
  | "colossal";

/**
 * Pathfinder's typed bonuses. Same-type bonuses generally do NOT stack
 * (take the highest); a few types DO stack (see STACKING_BONUS_TYPES).
 * Penalties of any type stack.
 */
export type BonusType =
  | "untyped"
  | "alchemical"
  | "armor"
  | "circumstance"
  | "competence"
  | "deflection"
  | "dodge"
  | "enhancement"
  | "inherent"
  | "insight"
  | "luck"
  | "morale"
  | "natural-armor"
  | "profane"
  | "racial"
  | "resistance"
  | "sacred"
  | "shield"
  | "size"
  | "trait";

/**
 * Where a modifier applies. Strings (not an enum) so content packs can target
 * skills dynamically (e.g. "skill.perception") without engine changes.
 *
 * Recognized group aliases (see TARGET_ALIASES):
 *   - "save.all"  -> fort, ref, will
 *   - "attack"    -> attack.melee, attack.ranged
 */
export type ModifierTarget =
  | AbilityKey
  | "ac"
  | "save.fort"
  | "save.ref"
  | "save.will"
  | "save.all"
  | "init"
  | "cmb"
  | "cmd"
  | "attack"
  | "attack.melee"
  | "attack.ranged"
  | "damage"
  | "damage.melee"
  | "damage.ranged"
  | "hp"
  | "speed"
  | (string & {});

export interface Modifier {
  /** What stat this affects. */
  target: ModifierTarget;
  /** Typed-bonus category that governs stacking. */
  type: BonusType;
  /** Magnitude. Positive = bonus, negative = penalty. */
  value: number;
  /** Human-readable provenance, e.g. "Bless", "Belt of Giant Strength +2". */
  source: string;
  /** Content provenance tag, e.g. "core", "savage-company". Optional. */
  pack?: string;
  /** Free-text note for conditional modifiers ("vs fear", "while raging"). */
  condition?: string;
  /** When false, the modifier is suppressed from all calculations. */
  enabled?: boolean;
}

/** A single line in a "why is this stat this number?" explanation. */
export interface BreakdownEntry {
  source: string;
  /** BonusType, or a structural label: "base" | "ability" | "dex" | "size". */
  type: string;
  value: number;
}

export interface DerivedStat {
  total: number;
  breakdown: BreakdownEntry[];
}

export interface DerivedAbility {
  score: number;
  mod: number;
  breakdown: BreakdownEntry[];
}

/** Standard Pathfinder 1e skill keys (subtypes use dotted keys). */
export type SkillKey =
  | "acrobatics"
  | "appraise"
  | "bluff"
  | "climb"
  | "craft"
  | "diplomacy"
  | "disable-device"
  | "disguise"
  | "escape-artist"
  | "fly"
  | "handle-animal"
  | "heal"
  | "intimidate"
  | "knowledge.arcana"
  | "knowledge.dungeoneering"
  | "knowledge.engineering"
  | "knowledge.geography"
  | "knowledge.history"
  | "knowledge.local"
  | "knowledge.nature"
  | "knowledge.nobility"
  | "knowledge.planes"
  | "knowledge.religion"
  | "linguistics"
  | "perception"
  | "perform"
  | "profession"
  | "ride"
  | "sense-motive"
  | "sleight-of-hand"
  | "spellcraft"
  | "stealth"
  | "survival"
  | "swim"
  | "use-magic-device"
  | (string & {});

export interface SkillDefinition {
  key: SkillKey;
  name: string;
  ability: AbilityKey;
  /** Cannot be used without at least 1 rank. */
  trainedOnly: boolean;
  /** Armor check penalty applies (Str- and Dex-based physical skills). */
  armorCheckPenalty: boolean;
}

export interface DerivedSkill {
  key: SkillKey;
  name: string;
  ability: AbilityKey;
  ranks: number;
  isClassSkill: boolean;
  trainedOnly: boolean;
  /** False if trained-only and the character has no ranks. */
  usable: boolean;
  total: number;
  breakdown: BreakdownEntry[];
}

/** Something gained at a particular character level (a feat or class feature). */
export interface NamedAcquisition {
  name: string;
  level: number;
}

/** A gained feature/feat currently suppressed by rules conditions. */
export interface SuppressedAcquisition extends NamedAcquisition {
  reason: string;
}

/** Non-mechanical identity carried through to the sheet (race/class/feats/etc.). */
export interface SheetDescriptor {
  race?: string;
  classes: NamedAcquisition[];
  archetypes: NamedAcquisition[];
  feats: NamedAcquisition[];
  features: NamedAcquisition[];
  suppressedFeatures: SuppressedAcquisition[];
}

export type WeaponCategory = "melee" | "ranged";
export type WeaponProficiencyGroup = "simple" | "martial" | "exotic";
export type WeaponDamageType = "bludgeoning" | "piercing" | "slashing";
export type WeaponReloadType = "free" | "move" | "full-round";
export type FirearmCategory = "one-handed" | "two-handed" | "scatter";
export type WeaponTechnology = "early" | "advanced";
export type WeaponSaveType = "fort" | "ref" | "will";
/** Affects Strength-to-damage multiplier (two-handed 1.5x, off-hand 0.5x). */
export type WeaponHandedness = "one" | "two" | "off" | "light";
export type ArmorCategory = "none" | "light" | "medium" | "heavy";
export type LoadBand = "light" | "medium" | "heavy" | "overloaded";
export type Condition = "fatigued" | (string & {});
export type MovementMode = "swim" | "climb" | "fly" | "burrow";
export type EnergyType = "acid" | "cold" | "electricity" | "fire" | "sonic";

export interface SenseProfile {
  darkvisionFeet?: number;
  lowLightVision?: boolean;
}

export type FerocityMode = "orc" | "half-orc";

export interface FavoredClassBonusDefinition {
  id: string;
  className: string;
  label: string;
  description: string;
  deathThresholdBonus?: number;
}

export interface RaceMetadata {
  movementModes?: Partial<Record<MovementMode, number>>;
  senses?: SenseProfile;
  resistances?: Partial<Record<EnergyType, number>>;
  ferocity?: FerocityMode;
  favoredClassBonuses?: FavoredClassBonusDefinition[];
  notes?: string[];
}

export interface FlexibleAbilityBonusOption {
  value: number;
  abilities?: AbilityKey[];
}

export interface RaceChoiceOptions {
  flexibleAbilityBonus?: FlexibleAbilityBonusOption;
  bonusFeat?: {
    count?: number;
    featOptions?: string[];
  };
  extraSkillRanksPerLevel?: number;
}

export type RaceChoiceOptionKey = keyof RaceChoiceOptions;

export interface RaceAlternateTrait {
  id: string;
  name: string;
  description: string;
  replaces?: string[];
  speed?: number;
  abilityModifiers?: Modifier[];
  traits?: Modifier[];
  classSkills?: SkillKey[];
  weaponProficiencies?: WeaponProficiencyGroup[];
  specificWeaponProficiencies?: string[];
  grantedWeapons?: Weapon[];
  movementModes?: Partial<Record<MovementMode, number>>;
  senses?: SenseProfile;
  resistances?: Partial<Record<EnergyType, number>>;
  notes?: string[];
  removeChoiceOptions?: RaceChoiceOptionKey[];
  choiceOptions?: Partial<RaceChoiceOptions>;
}

export interface WeaponOrdnanceProfile {
  saveDc?: number;
  saveType?: WeaponSaveType;
  area?: string;
  duration?: string;
  directHitEffect?: string;
  notes?: string[];
}

export interface WeaponAmmoConsumption {
  ammoType: string;
  amount: number;
}

export interface WeaponAmmoAvailability extends WeaponAmmoConsumption {
  available: number;
}

export interface Weapon {
  name: string;
  weaponTemplateId?: string;
  category: WeaponCategory;
  proficiencyGroup?: WeaponProficiencyGroup;
  proficient?: boolean;
  /** Damage dice, e.g. "1d12". */
  damageDice: string;
  handedness?: WeaponHandedness;
  /** Lowest natural roll that threatens a crit (e.g. 19 for 19-20). Default 20. */
  critRange?: number;
  critMultiplier?: number;
  rangeIncrementFeet?: number;
  damageTypes?: WeaponDamageType[];
  specialTags?: string[];
  ammoType?: string;
  loadedAmmoType?: string;
  ammoPerAttack?: number;
  ammoConsumptions?: WeaponAmmoConsumption[];
  reloadType?: WeaponReloadType;
  firearmCategory?: FirearmCategory;
  weaponTechnology?: WeaponTechnology;
  attackModifier?: number;
  extraDamageDice?: string[];
  ammoNotes?: string[];
  ordnanceProfile?: WeaponOrdnanceProfile;
  sourceKind?: "race" | "equipment" | "build";
  sourceIndex?: number;
  misfire?: number;
  targetsTouchAcWithinFirstRangeIncrement?: boolean;
  /** Ability added to damage. Defaults: Str (melee), none (ranged). */
  damageAbility?: AbilityKey | null;
}

export interface DerivedWeapon {
  name: string;
  weaponTemplateId?: string;
  category: WeaponCategory;
  attack: DerivedStat;
  damageDice: string;
  damageBonus: number;
  /** e.g. "1d12+7". */
  damageDisplay: string;
  damageBreakdown: BreakdownEntry[];
  /** e.g. "20/x3" or "19-20/x2". */
  crit: string;
  rangeIncrementFeet?: number;
  damageTypes?: WeaponDamageType[];
  specialTags?: string[];
  ammoType?: string;
  loadedAmmoType?: string;
  ammoAvailable?: number;
  ammoPerAttack?: number;
  ammoConsumptions?: WeaponAmmoConsumption[];
  ammoAvailability?: WeaponAmmoAvailability[];
  reloadType?: WeaponReloadType;
  firearmCategory?: FirearmCategory;
  weaponTechnology?: WeaponTechnology;
  attackModifier?: number;
  extraDamageDice?: string[];
  ammoNotes?: string[];
  ordnanceProfile?: WeaponOrdnanceProfile;
  sourceKind?: "race" | "equipment" | "build";
  sourceIndex?: number;
  misfire?: number;
  targetsTouchAcWithinFirstRangeIncrement?: boolean;
}

export interface Encumbrance {
  carriedWeight: number;
  lightMax: number;
  mediumMax: number;
  heavyMax: number;
  band: LoadBand;
}

export interface InventorySummary {
  itemCount: number;
  equippedCount: number;
  totalWeight: number;
  totalCostGp: number;
}

export interface InventoryArmorDetails {
  category: ArmorCategory;
  acBonus?: number;
  maxDexBonus?: number;
  checkPenalty?: number;
  speedPenalty?: number;
}

export type InventoryEquipmentSlot =
  | "slotless"
  | "armor"
  | "shield"
  | "head"
  | "eyes"
  | "neck"
  | "shoulders"
  | "chest"
  | "body"
  | "torso"
  | "belt"
  | "wrists"
  | "hands"
  | "feet"
  | "ring";

export interface InventoryShieldDetails {
  acBonus?: number;
  checkPenalty?: number;
}

export interface InventoryWeaponDetails {
  weaponTemplateId?: string;
  category: WeaponCategory;
  proficiencyGroup?: WeaponProficiencyGroup;
  damageDice: string;
  handedness?: WeaponHandedness;
  critRange?: number;
  critMultiplier?: number;
  rangeIncrementFeet?: number;
  damageTypes?: WeaponDamageType[];
  specialTags?: string[];
  ammoType?: string;
  loadedAmmoType?: string;
  ammoPerAttack?: number;
  reloadType?: WeaponReloadType;
  firearmCategory?: FirearmCategory;
  weaponTechnology?: WeaponTechnology;
  attackModifier?: number;
  extraDamageDice?: string[];
  ammoNotes?: string[];
  ordnanceProfile?: WeaponOrdnanceProfile;
  misfire?: number;
  targetsTouchAcWithinFirstRangeIncrement?: boolean;
  damageAbility?: AbilityKey | null;
}

export type InventoryOwnership = "owned" | "wishlist";
export type InventoryComponentCategory =
  | "material"
  | "focus"
  | "divine-focus"
  | "spellbook"
  | "kit";

export interface DerivedInventoryItem {
  name: string;
  quantity: number;
  weightEach: number;
  totalWeight: number;
  costEachGp: number;
  totalCostGp: number;
  equipped: boolean;
  ownership?: InventoryOwnership;
  carryState?: "carried" | "stowed" | "cached";
  slot?: InventoryEquipmentSlot;
  containerName?: string;
  containerCapacityLb?: number;
  componentCategory?: InventoryComponentCategory;
  spellTriggerNames?: string[];
  ammoType?: string;
  usesRemaining?: number;
  usesMax?: number;
  armor?: InventoryArmorDetails;
  shield?: InventoryShieldDetails;
  weapon?: InventoryWeaponDetails;
}

export type SpellcastingType = "prepared" | "spontaneous";

export type SpellSelectionByLevel = Partial<Record<number, string[]>>;

export interface SpellSelectionState {
  prepared?: SpellSelectionByLevel;
  known?: SpellSelectionByLevel;
}

export type SpellLibraryState = SpellSelectionByLevel;

export type SpellSlotUsageByLevel = Partial<Record<number, number>>;
export type SpellExtraSlotsByLevel = Partial<Record<number, number>>;

export interface HitPointDieBreakdown {
  className: string;
  hitDie: number;
  count: number;
  hpFromRolls: number;
}

export interface HitPointDetails {
  dice: HitPointDieBreakdown[];
  rolledHpTotal: number;
  constitutionBonusTotal: number;
  favoredClassHpTotal: number;
  miscHpTotal: number;
}

export interface SpellcastingEntry {
  className: string;
  castingType: SpellcastingType;
  castingAbility: AbilityKey;
  casterLevel: number;
  domains?: string[];
  specialistSchool?: string;
  spellsPerDay: Partial<Record<number, number>>;
  spellsKnown?: Partial<Record<number, number>>;
  extraSlots?: SpellExtraSlotsByLevel;
  restrictedExtraSlots?: SpellExtraSlotsByLevel;
  grantedSpells?: SpellLibraryState;
  selections?: SpellSelectionState;
  library?: SpellLibraryState;
  slotsUsed?: SpellSlotUsageByLevel;
}

export interface SpellSelectionDiagnostic {
  mode: SpellcastingType;
  level: number;
  capacity: number;
  selectedCount: number;
  availableSpellNames: string[];
  librarySpellNames: string[];
  unknownSpells: string[];
  offListSpells: string[];
  wrongLevelSpells: { name: string; actualLevel: number }[];
  missingFromLibrary: string[];
  requiredAbilityScore: number;
  canCastLevel: boolean;
  isAtWill: boolean;
  overCapacity: boolean;
  restrictedSlotCapacity: number;
  restrictedSlotEligibleSpellNames: string[];
  restrictedSlotEligibleSelectedCount: number;
  restrictedSlotShortfall: number;
}

export interface DerivedSpellcasting {
  className: string;
  castingType: SpellcastingType;
  castingAbility: AbilityKey;
  castingAbilityScore: number;
  maxCastableSpellLevel: number;
  casterLevel: number;
  domains: string[];
  specialistSchool?: string;
  concentration: DerivedStat;
  baseSpellsPerDay: Partial<Record<number, number>>;
  bonusSpellsPerDay: Partial<Record<number, number>>;
  extraSlotsPerDay: SpellExtraSlotsByLevel;
  restrictedExtraSlotsPerDay: SpellExtraSlotsByLevel;
  spellsPerDay: Partial<Record<number, number>>;
  spellsKnown: Partial<Record<number, number>>;
  preparedCapacity: Partial<Record<number, number>>;
  grantedSpells: SpellLibraryState;
  librarySpells: SpellLibraryState;
  selectedPreparedSpells: SpellSelectionByLevel;
  selectedKnownSpells: SpellSelectionByLevel;
  selectionDiagnostics: Partial<Record<number, SpellSelectionDiagnostic>>;
  slotsUsed: SpellSlotUsageByLevel;
  slotsRemaining: SpellSlotUsageByLevel;
  spellSaveDcs: Partial<Record<number, number>>;
  maxSpellLevel: number;
}

export interface CharacterInput {
  raceMetadata?: RaceMetadata;
  name: string;
  level: number;
  size: Size;
  /** Descriptive identity (race/class/feats/features) for display. */
  descriptor?: SheetDescriptor;
  /** Equipped weapons to derive attack/damage lines for. */
  weapons?: Weapon[];
  /** Active character conditions (fatigued, etc.). */
  conditions?: Condition[];
  /** Armor category currently worn (for feature legality like Fast Movement). */
  armorCategory?: ArmorCategory;
  /** Total carried weight in pounds for encumbrance. */
  carriedWeight?: number;
  /** Inventory aggregate for UI/reporting. */
  inventory?: InventorySummary;
  /** Inventory line items for display/reporting. */
  inventoryItems?: DerivedInventoryItem[];
  /** Derived spellcasting entries from classes/archetypes/etc. */
  spellcasting?: SpellcastingEntry[];
  /** Base ability scores BEFORE modifiers (racial/enhancement/etc. as modifiers). */
  abilityScores: AbilityScores;
  baseAttackBonus: number;
  baseSaves: { fort: number; ref: number; will: number };
  /** Max Dex bonus to AC from worn armor. Omit for no cap. */
  maxDexBonus?: number;
  /** Armor check penalty magnitude (positive number, subtracted from affected skills). */
  armorCheckPenalty?: number;
  /** Base land speed in feet. Defaults to 30. */
  baseSpeed?: number;
  /** Per-hit-die rolled/fixed HP, BEFORE Con. One entry per HD. */
  rolledHitPoints?: number[];
  /** Expanded HP provenance for richer UI breakdowns. */
  hitPointDetails?: HitPointDetails;
  /** Skill keys treated as class skills (grant +3 when 1+ ranks invested). */
  classSkills?: SkillKey[];
  /** Ranks invested per skill. */
  skillRanks?: Partial<Record<SkillKey, number>>;
  /** Explicit usability overrides for trained-only skills/archetype exceptions. */
  skillUsableOverrides?: Partial<Record<SkillKey, boolean>>;
  /** Explicit weapon damage-ability overrides keyed by weapon name/template id. */
  weaponDamageAbilityOverrides?: Partial<Record<string, AbilityKey | null>>;
  /** Every active effect: feats, gear, class features, conditions, buffs, auras. */
  modifiers: Modifier[];
}

export interface RangedCombatStatus {
  ammoByType: Record<string, number>;
}

export interface DerivedSheet {
  raceMetadata?: RaceMetadata;
  name: string;
  level: number;
  size: Size;
  abilities: Record<AbilityKey, DerivedAbility>;
  ac: { normal: DerivedStat; touch: DerivedStat; flatFooted: DerivedStat };
  saves: { fort: DerivedStat; ref: DerivedStat; will: DerivedStat };
  initiative: DerivedStat;
  baseAttackBonus: number;
  cmb: DerivedStat;
  cmd: DerivedStat;
  attack: { melee: DerivedStat; ranged: DerivedStat };
  hitPoints: DerivedStat;
  hitPointDetails: HitPointDetails;
  speed: DerivedStat;
  skills: Record<SkillKey, DerivedSkill>;
  weapons: DerivedWeapon[];
  encumbrance: Encumbrance;
  inventory: InventorySummary;
  inventoryItems: DerivedInventoryItem[];
  rangedCombat: RangedCombatStatus;
  spellcasting: DerivedSpellcasting[];
  /** Race/class/feats/features for display (empty if not provided). */
  descriptor: SheetDescriptor;
}
