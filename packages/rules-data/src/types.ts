import type {
  AbilityKey,
  ClassFeatureDefinition,
  ClassDefinition,
  DomainDefinition,
  FeatDefinition,
  MagicItemDefinition,
  SchoolDefinition,
  SkillDefinition,
  SpellDefinition,
  SpellEffectDefinition,
  WeaponDefinition,
} from "@mathfinder/rules-engine";
import type {
  Modifier,
  RaceAlternateTrait,
  RaceChoiceOptions,
  RaceMetadata,
  Size,
  SkillKey,
  Weapon,
} from "@mathfinder/rules-engine";

export type ContentKind =
  | "class"
  | "archetype"
  | "class-feature"
  | "feat"
  | "race"
  | "skill"
  | "spell"
  | "weapon"
  | "magic-item"
  | "domain"
  | "school"
  | "spell-effect"
  | "bloodline"
  | "kineticist-element"
  | "phantom-emotional-focus"
  | "eidolon-subtype"
  | "hex"
  | "blessing"
  | "trap-option"
  | "build-guide";

export interface ContentSource {
  id: string;
  name: string;
  publisher: string;
  product?: string;
  type: "first-party" | "owner-authored";
  license: "prdofficial" | "ogl" | "owner-approved" | "unknown";
  notes?: string;
}

export interface OptionFeatureDefinition {
  level?: number;
  name: string;
  summary: string;
}

export type ArchetypeFeatureDefinition = OptionFeatureDefinition;

export interface ArchetypeDefinition {
  id: string;
  name: string;
  pack: string;
  baseClassName: string;
  description: string;
  replaces?: string[];
  alters?: string[];
  modifies?: string[];
  features?: ArchetypeFeatureDefinition[];
  notes?: string[];
}

export interface BloodlineDefinition {
  id: string;
  name: string;
  pack: string;
  baseClassName: string;
  description: string;
  classSkill?: string;
  bonusSpells?: string[];
  bonusFeats?: string[];
  arcana?: string;
  powers?: OptionFeatureDefinition[];
}

export interface KineticistElementDefinition {
  id: string;
  name: string;
  pack: string;
  description: string;
  basicManipulation?: string;
  simpleBlast?: string;
  defense?: string;
  infusions?: string[];
  utilityTalents?: string[];
  notes?: string[];
}

export interface PhantomEmotionalFocusDefinition {
  id: string;
  name: string;
  pack: string;
  description: string;
  skills?: string[];
  goodSaves?: string[];
  abilityAdjustments?: string;
  powers?: OptionFeatureDefinition[];
}

export interface EidolonSubtypeDefinition {
  id: string;
  name: string;
  pack: string;
  description: string;
  baseForm?: string;
  baseEvolutions?: string[];
  progression?: OptionFeatureDefinition[];
  notes?: string[];
}

export interface HexDefinition {
  id: string;
  name: string;
  pack: string;
  baseClassName: string;
  category: "hex" | "major-hex" | "grand-hex";
  description: string;
}

export interface BlessingDefinition {
  id: string;
  name: string;
  pack: string;
  baseClassName: string;
  description: string;
  minor?: string;
  major?: string;
}

export interface TrapOptionDefinition {
  id: string;
  name: string;
  pack: string;
  category: string;
  description: string;
  restrictions?: string[];
}

export interface BuildGuideBranchCondition {
  minLevel?: number;
  maxLevel?: number;
  abilityAtLeast?: Partial<Record<AbilityKey, number>>;
  featNamesAny?: string[];
  classNamesAny?: string[];
  archetypeIdsAny?: string[];
  favoredClassMatches?: boolean;
}

export interface BuildGuideBranchDefinition {
  id: string;
  when: BuildGuideBranchCondition;
  classNames?: string[];
  statPriorities?: AbilityKey[];
  featPriorities?: string[];
  favoredClassBonusPriority?: Array<"hp" | "skill">;
  skillPriorities?: SkillKey[];
  spellPriorities?: string[];
  notes?: string[];
}

export interface BuildGuideProgressionBand {
  minLevel?: number;
  maxLevel?: number;
  classNames?: string[];
  statPriorities?: AbilityKey[];
  featPriorities?: string[];
  favoredClassBonusPriority?: Array<"hp" | "skill">;
  skillPriorities?: SkillKey[];
  spellPriorities?: string[];
  notes?: string[];
}

export interface BuildGuideDefinition {
  id: string;
  name: string;
  pack: string;
  description: string;
  priority?: number;
  classNames?: string[];
  archetypeIds?: string[];
  raceIds?: string[];
  favoredClassName?: string;
  statPriorities?: AbilityKey[];
  featPriorities?: string[];
  favoredClassBonusPriority?: Array<"hp" | "skill">;
  skillPriorities?: SkillKey[];
  spellPriorities?: string[];
  progression?: BuildGuideProgressionBand[];
  branches?: BuildGuideBranchDefinition[];
  notes?: string[];
}

export interface RaceDefinition extends RaceMetadata {
  id: string;
  name: string;
  pack: string;
  size: Size;
  speed: number;
  abilityModifiers: Modifier[];
  traits?: Modifier[];
  classSkills?: SkillKey[];
  weaponProficiencies?: Array<"simple" | "martial" | "exotic">;
  specificWeaponProficiencies?: string[];
  choiceOptions?: RaceChoiceOptions;
  alternateTraits?: RaceAlternateTrait[];
  grantedWeapons?: Weapon[];
}

export interface RulesPack {
  id: string;
  name: string;
  enabledByDefault: boolean;
  sourceId: string;
  version: string;
  classes: ClassDefinition[];
  archetypes: ArchetypeDefinition[];
  bloodlines: BloodlineDefinition[];
  kineticistElements: KineticistElementDefinition[];
  phantomEmotionalFocuses: PhantomEmotionalFocusDefinition[];
  eidolonSubtypes: EidolonSubtypeDefinition[];
  hexes: HexDefinition[];
  blessings: BlessingDefinition[];
  trapOptions: TrapOptionDefinition[];
  buildGuides: BuildGuideDefinition[];
  classFeatures: ClassFeatureDefinition[];
  feats: FeatDefinition[];
  races: RaceDefinition[];
  skills: SkillDefinition[];
  spells: SpellDefinition[];
  weapons: WeaponDefinition[];
  magicItems: MagicItemDefinition[];
  domains: DomainDefinition[];
  schools: SchoolDefinition[];
  spellEffects: SpellEffectDefinition[];
}

export interface RulesDataSet {
  schemaVersion: string;
  generatedAt: string;
  sources: ContentSource[];
  packs: RulesPack[];
}

export interface RulesDataIndex {
  sources: Record<string, ContentSource>;
  packs: Record<string, RulesPack>;
  classes: Record<string, ClassDefinition>;
  archetypes: Record<string, ArchetypeDefinition>;
  archetypesByClass: Record<string, ArchetypeDefinition[]>;
  bloodlines: Record<string, BloodlineDefinition>;
  kineticistElements: Record<string, KineticistElementDefinition>;
  phantomEmotionalFocuses: Record<string, PhantomEmotionalFocusDefinition>;
  eidolonSubtypes: Record<string, EidolonSubtypeDefinition>;
  hexes: Record<string, HexDefinition>;
  blessings: Record<string, BlessingDefinition>;
  trapOptions: Record<string, TrapOptionDefinition>;
  buildGuides: Record<string, BuildGuideDefinition>;
  classFeaturesByClass: Record<string, ClassFeatureDefinition[]>;
  feats: Record<string, FeatDefinition>;
  races: Record<string, RaceDefinition>;
  skills: Record<string, SkillDefinition>;
  spells: Record<string, SpellDefinition>;
  weapons: Record<string, WeaponDefinition>;
  magicItems: Record<string, MagicItemDefinition>;
  domains: Record<string, DomainDefinition>;
  schools: Record<string, SchoolDefinition>;
  spellEffects: Record<string, SpellEffectDefinition>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
