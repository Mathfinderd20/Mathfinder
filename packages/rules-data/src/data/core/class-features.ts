import {
  CORE_CLASS_FEATURES,
  type ClassFeatureDefinition,
} from "@mathfinder/rules-engine";

export const CORE_RULES_CLASS_FEATURES: ClassFeatureDefinition[] =
  CORE_CLASS_FEATURES.map((feature) => ({
    ...feature,
    effects: feature.effects.map((effect) => ({
      ...effect,
      pack: effect.pack ?? feature.pack,
    })),
  }));
