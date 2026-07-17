import type { RulesPack } from "../../types";
import { SAVAGE_COMPANY_ARCHETYPES } from "./archetypes";
import { SAVAGE_COMPANY_BLESSINGS } from "./blessings";
import { SAVAGE_COMPANY_BLOODLINES } from "./bloodlines";
import { SAVAGE_COMPANY_CLASS_FEATURES } from "./class-features";
import { SAVAGE_COMPANY_BUILD_GUIDES } from "./build-guides";
import { SAVAGE_COMPANY_CLASSES } from "./classes";
import { SAVAGE_COMPANY_EIDOLON_SUBTYPES } from "./eidolon-subtypes";
import { SAVAGE_COMPANY_KINETICIST_ELEMENTS } from "./kineticist-elements";
import { SAVAGE_COMPANY_PHANTOM_FOCUSES } from "./phantom-focuses";
import { SAVAGE_COMPANY_RACES } from "./races";
import { SAVAGE_COMPANY_TRAPS } from "./traps";
import { SAVAGE_COMPANY_WEAPONS } from "./weapons";
import { SAVAGE_COMPANY_WITCH_HEXES } from "./witch-hexes";

export const SAVAGE_COMPANY_RULES_PACK: RulesPack = {
  id: "savage-company",
  name: "Savage Company",
  enabledByDefault: true,
  sourceId: "savage-company",
  version: "0.4.0-option-taxonomies",
  classes: SAVAGE_COMPANY_CLASSES,
  archetypes: SAVAGE_COMPANY_ARCHETYPES,
  bloodlines: SAVAGE_COMPANY_BLOODLINES,
  kineticistElements: SAVAGE_COMPANY_KINETICIST_ELEMENTS,
  phantomEmotionalFocuses: SAVAGE_COMPANY_PHANTOM_FOCUSES,
  eidolonSubtypes: SAVAGE_COMPANY_EIDOLON_SUBTYPES,
  hexes: SAVAGE_COMPANY_WITCH_HEXES,
  blessings: SAVAGE_COMPANY_BLESSINGS,
  trapOptions: SAVAGE_COMPANY_TRAPS,
  buildGuides: SAVAGE_COMPANY_BUILD_GUIDES,
  classFeatures: SAVAGE_COMPANY_CLASS_FEATURES,
  feats: [],
  races: SAVAGE_COMPANY_RACES,
  skills: [],
  spells: [],
  weapons: SAVAGE_COMPANY_WEAPONS,
  magicItems: [],
  domains: [],
  schools: [],
  spellEffects: [],
};
