import { CORE_FEATS, type FeatDefinition } from "@path-builder/rules-engine";

export const CORE_RULES_FEATS: FeatDefinition[] = CORE_FEATS.map((feat) => ({
  ...feat,
  effects: feat.effects.map((effect) => ({ ...effect, pack: effect.pack ?? feat.pack })),
}));
