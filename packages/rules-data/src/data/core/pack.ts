import type { RulesPack } from "../../types";
import { CORE_CLASSES } from "./classes";
import { CORE_RULES_CLASS_FEATURES } from "./class-features";
import { CORE_RULES_FEATS } from "./feats";
import { CORE_RACES } from "./races";
import { CORE_SKILLS } from "./skills";
import { CORE_RULES_SPELLS } from "./spells";

export const CORE_RULES_PACK: RulesPack = {
  id: "core",
  name: "Core Pathfinder Seed",
  enabledByDefault: true,
  sourceId: "paizo-prd",
  version: "0.1.0-seed",
  classes: CORE_CLASSES,
  classFeatures: CORE_RULES_CLASS_FEATURES,
  feats: CORE_RULES_FEATS,
  races: CORE_RACES,
  skills: CORE_SKILLS,
  spells: CORE_RULES_SPELLS,
};
