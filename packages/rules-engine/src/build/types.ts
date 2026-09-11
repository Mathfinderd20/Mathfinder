import type {
  AbilityKey,
  AbilityScores,
  Condition,
  Modifier,
  RaceAlternateTrait,
  RaceChoiceOptions,
  RaceMetadata,
  Size,
  SkillKey,
  SpellExtraSlotsByLevel,
  SpellLibraryState,
  SpellSelectionState,
  SpellSlotUsageByLevel,
  Weapon,
} from "../types";
import type { FeatGrantKind } from "../content/feats";
import type { CampaignRules } from "../campaign-rules";
import type { Alignment } from "../alignment";

export interface RaceChoiceSelection {
  flexibleAbility?: AbilityKey;
  bonusFeat?: string;
  alternateTraits?: string[];
}

export interface RaceChoice extends RaceMetadata {
  id?: string;
  name: string;
  size: Size;
  speed?: number;
  abilityModifiers?: Modifier[];
  traits?: Modifier[];
  classSkills?: SkillKey[];
  weaponProficiencies?: Array<"simple" | "martial" | "exotic">;
  specificWeaponProficiencies?: string[];
  grantedWeapons?: Weapon[];
  choiceOptions?: RaceChoiceOptions;
  alternateTraits?: RaceAlternateTrait[];
  choiceSelection?: RaceChoiceSelection;
}

export interface LevelEntry {
  className: string;
  hitPointRoll: number;
  skillRanks?: Partial<Record<SkillKey, number>>;
  feats?: string[];
  features?: string[];
  abilityIncrease?: AbilityKey;
  favoredClass?: string;
  favoredClassSelection?: string;
  modifiers?: Modifier[];
}

export type EquipmentSlot =
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

export const EQUIPMENT_SLOT_CAPACITY: Record<EquipmentSlot, number> = {
  slotless: Number.POSITIVE_INFINITY,
  armor: 1,
  shield: 1,
  head: 1,
  eyes: 1,
  neck: 1,
  shoulders: 1,
  chest: 1,
  body: 1,
  torso: 1,
  belt: 1,
  wrists: 1,
  hands: 1,
  feet: 1,
  ring: 2,
};

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "slotless",
  "armor",
  "shield",
  "head",
  "eyes",
  "neck",
  "shoulders",
  "chest",
  "body",
  "torso",
  "belt",
  "wrists",
  "hands",
  "feet",
  "ring",
];

export type EquipmentOwnership = "owned" | "wishlist";
export type EquipmentComponentCategory =
  "material" | "focus" | "divine-focus" | "spellbook" | "kit";

export interface EquipmentEntry {
  kind?: "magic" | "mundane";
  ownership?: EquipmentOwnership;
  itemTemplateId?: string;
  name: string;
  quantity?: number;
  weight?: number;
  costGp?: number;
  equipped?: boolean;
  carryState?: "carried" | "stowed" | "cached";
  slot?: EquipmentSlot;
  containerName?: string;
  containerCapacityLb?: number;
  componentCategory?: EquipmentComponentCategory;
  spellTriggerNames?: string[];
  ammoType?: string;
  usesRemaining?: number;
  usesMax?: number;
  modifiers?: Modifier[];
  armor?: {
    category?: "light" | "medium" | "heavy";
    acBonus?: number;
    maxDexBonus?: number;
    checkPenalty?: number;
    /** Manual fallback for custom armor without speed profiles. */
    speedPenalty?: number;
    /** Resulting land speed for creatures whose base speed is 30 or 20 feet. */
    speed30?: number;
    speed20?: number;
    /** Fraction of armor AC retained against ranged attacks that target touch AC. */
    rangedTouchArmorFraction?: number;
  };
  damageReductions?: Array<{
    value: number;
    bypass: string;
    appliesAgainst: string;
    label?: string;
  }>;
  shield?: {
    acBonus?: number;
    checkPenalty?: number;
    /** Fraction of shield AC retained against ranged attacks that target touch AC. */
    rangedTouchShieldFraction?: number;
  };
  weapon?: Omit<Weapon, "name" | "proficient">;
}

export interface CharacterBuild {
  languages?: {
    starting?: string[];
    learned?: string[];
    additional?: string[];
  };
  name: string;
  /** Optional only for backward compatibility with persisted pre-alignment builds. */
  alignment?: Alignment;
  race: RaceChoice;
  classArchetypes?: Partial<Record<string, string[]>>;
  favoredClassName?: string;
  campaignRules?: CampaignRules;
  coinPurse?: {
    pp?: number;
    gp?: number;
    sp?: number;
    cp?: number;
  };
  coinWeightCountsTowardEncumbrance?: boolean;
  baseAbilityScores: AbilityScores;
  levels: LevelEntry[];
  equipment?: EquipmentEntry[];
  weapons?: Weapon[];
  weaponDamageAbilityOverrides?: Partial<Record<string, AbilityKey | null>>;
  gunTrainingSelections?: Partial<Record<string, string[]>>;
  spellLibrary?: Record<string, SpellLibraryState>;
  spellSelections?: Record<string, SpellSelectionState>;
  spellDomains?: Record<string, string[]>;
  spellSpecializations?: Record<string, string | undefined>;
  spellExtraSlots?: Record<string, SpellExtraSlotsByLevel>;
  spellSlotUsage?: Record<string, SpellSlotUsageByLevel>;
  conditions?: Condition[];
  /** @deprecated Persisted legacy field, ignored. Carried load is calculated from equipment and coins. */
  carriedWeight?: number;
  otherModifiers?: Modifier[];
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  level?: number;
}

export interface FeatGrantSlot {
  kind: FeatGrantKind;
  label: string;
  source: string;
}

export interface LevelUpPlan {
  characterLevel: number;
  className: string;
  hitDie: number;
  averageHitPoints: number;
  skillPoints: number;
  maxRanksPerSkill: number;
  grantsFeat: boolean;
  featSlots: FeatGrantSlot[];
  grantsAbilityIncrease: boolean;
  classSkills: SkillKey[];
}

export interface LevelUpSelection {
  className: string;
  hitPointRoll: number;
  skillRanks: Partial<Record<SkillKey, number>>;
  feats?: string[];
  abilityIncrease?: AbilityKey;
  favoredClass?: string;
  favoredClassSelection?: string;
}

export interface PreLevelBuildSelection {
  className: string;
  hitPointRoll?: number;
  skillRanks?: Partial<Record<SkillKey, number>>;
  feats?: string[];
  abilityIncrease?: AbilityKey;
  favoredClass?: string;
  favoredClassSelection?: string;
}

export interface PreLevelBuildResult {
  plan: LevelUpPlan;
  selection: LevelUpSelection;
  build: CharacterBuild;
}
