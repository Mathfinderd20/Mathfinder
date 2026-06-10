import type {
  ClassFeatureDefinition,
  ClassDefinition,
  FeatDefinition,
  SkillDefinition,
  SpellDefinition,
} from "@mathfinder/rules-engine";
import type { Modifier, Size, SkillKey } from "@mathfinder/rules-engine";

export type ContentKind =
  | "class"
  | "class-feature"
  | "feat"
  | "race"
  | "skill"
  | "spell";

export interface ContentSource {
  id: string;
  name: string;
  publisher: string;
  product?: string;
  type: "first-party" | "owner-authored";
  license: "prdofficial" | "ogl" | "owner-approved" | "unknown";
  notes?: string;
}

export interface RaceDefinition {
  id: string;
  name: string;
  pack: string;
  size: Size;
  speed: number;
  abilityModifiers: Modifier[];
  traits?: Modifier[];
  classSkills?: SkillKey[];
}

export interface RulesPack {
  id: string;
  name: string;
  enabledByDefault: boolean;
  sourceId: string;
  version: string;
  classes: ClassDefinition[];
  classFeatures: ClassFeatureDefinition[];
  feats: FeatDefinition[];
  races: RaceDefinition[];
  skills: SkillDefinition[];
  spells: SpellDefinition[];
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
  classFeaturesByClass: Record<string, ClassFeatureDefinition[]>;
  feats: Record<string, FeatDefinition>;
  races: Record<string, RaceDefinition>;
  skills: Record<string, SkillDefinition>;
  spells: Record<string, SpellDefinition>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
