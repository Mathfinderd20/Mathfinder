export type ContentEntityKind =
  | "class"
  | "archetype"
  | "class-feature"
  | "feat"
  | "race"
  | "skill"
  | "spell"
  | "weapon"
  | "armor"
  | "gear"
  | "magic-item"
  | "domain"
  | "school"
  | "spell-effect";

export interface ContentEntityRow {
  entityKey: string;
  kind: ContentEntityKind;
  entityId: string;
  name: string;
  packId?: string;
  origin: "seed" | "scrape";
  externalSource?: string;
  sourceUrl?: string;
  sourcePage?: number;
  payloadJson: string;
  importedAt: string;
  updatedAt: string;
}

export interface ParsedScrapedSpell {
  name: string;
  source?: string;
  school?: string;
  levelText?: string;
  castingTime?: string;
  components?: string;
  range?: string;
  targetEffectArea?: string;
  duration?: string;
  savingThrow?: string;
  spellResistance?: string;
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedFeat {
  name: string;
  category?: string;
  source?: string;
  prerequisites?: string;
  benefit?: string;
  normal?: string;
  special?: string;
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedMagicItem {
  name: string;
  source?: string;
  aura?: string;
  cl?: string;
  slot?: string;
  price?: string;
  weight?: string;
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedArchetypeFeature {
  name: string;
  featureType?: string;
  level?: number;
  summary: string;
}

export interface ParsedScrapedArchetype {
  name: string;
  baseClassName: string;
  source?: string;
  description: string;
  replaces?: string[];
  alters?: string[];
  features: ParsedScrapedArchetypeFeature[];
  sourceUrl: string;
}

export interface ParsedScrapedClassFeature {
  className: string;
  name: string;
  featureType?: string;
  source?: string;
  levels: number[];
  levelOptional?: boolean;
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedWeapon {
  name: string;
  source?: string;
  cost?: string;
  weight?: string;
  damageSmall?: string;
  damageMedium?: string;
  critical?: string;
  range?: string;
  type?: string;
  special?: string;
  category?: string;
  proficiency?: string;
  weaponGroups?: string;
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedRaceTrait {
  name: string;
  text?: string;
}

export interface ParsedScrapedFavoredClassBonus {
  className: string;
  description: string;
  sources?: string[];
}

export interface ParsedScrapedRace {
  name: string;
  source?: string;
  category?: string;
  abilityScoreText?: string;
  raceType?: string;
  size?: string;
  speedText?: string;
  languages?: string;
  traitEntries?: ParsedScrapedRaceTrait[];
  favoredClassBonuses?: ParsedScrapedFavoredClassBonus[];
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedArmor {
  name: string;
  source?: string;
  cost?: string;
  armorBonus?: string;
  maxDexBonus?: string;
  armorCheckPenalty?: string;
  arcaneSpellFailure?: string;
  speed30?: string;
  speed20?: string;
  weight?: string;
  category?: string;
  description: string;
  sourceUrl: string;
}

export interface ParsedScrapedGear {
  name: string;
  source?: string;
  cost?: string;
  weight?: string;
  category?: string;
  description: string;
  sourceUrl: string;
}
