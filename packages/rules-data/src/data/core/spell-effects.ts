import {
  SPELL_EFFECTS,
  resolveSpellEffect,
  type SpellEffectDefinition,
} from "@mathfinder/rules-engine";

export const CORE_RULES_SPELL_EFFECTS: SpellEffectDefinition[] =
  SPELL_EFFECTS.map((effect) => ({
    ...effect,
    modifiers: resolveSpellEffect(effect, {
      characterLevel: 1,
      highestCasterLevel: 1,
    }).modifiers.map((modifier) => ({
      ...modifier,
      pack: modifier.pack ?? "core",
    })),
  }));
