import type { RulesPack } from "../../types";
import { CORE_CLASSES } from "./classes";
import { CORE_RULES_CLASS_FEATURES } from "./class-features";
import { CORE_BUILD_GUIDES } from "./build-guides";
import { CORE_RULES_FEATS } from "./feats";
import { CORE_RACES } from "./races";
import { CORE_SKILLS } from "./skills";
import { CORE_RULES_SPELLS } from "./spells";
import { CORE_RULES_WEAPONS } from "./weapons";
import { CORE_RULES_MAGIC_ITEMS } from "./magic-items";
import { CORE_RULES_DOMAINS } from "./domains";
import { CORE_RULES_SCHOOLS } from "./schools";
import { CORE_RULES_SPELL_EFFECTS } from "./spell-effects";

export const CORE_RULES_PACK: RulesPack = {
  id: "core",
  name: "Core Pathfinder Seed",
  enabledByDefault: true,
  sourceId: "paizo-prd",
  version: "0.1.0-seed",
  classes: CORE_CLASSES,
  archetypes: [],
  bloodlines: [],
  kineticistElements: [],
  phantomEmotionalFocuses: [],
  eidolonSubtypes: [],
  hexes: [],
  blessings: [],
  trapOptions: [],
  buildGuides: CORE_BUILD_GUIDES,
  classFeatures: CORE_RULES_CLASS_FEATURES,
  feats: CORE_RULES_FEATS,
  races: CORE_RACES,
  skills: CORE_SKILLS,
  spells: CORE_RULES_SPELLS,
  weapons: CORE_RULES_WEAPONS,
  magicItems: CORE_RULES_MAGIC_ITEMS,
  domains: CORE_RULES_DOMAINS,
  schools: CORE_RULES_SCHOOLS,
  spellEffects: CORE_RULES_SPELL_EFFECTS,
};
