import type { Modifier, ModifierTarget, BonusType } from "../types";

export interface SpellEffectRuntimeContext {
  characterLevel: number;
  highestCasterLevel: number;
}

export interface SpellEffectTrackerDefinition {
  label: string;
  max: (context: SpellEffectRuntimeContext) => number;
  seedMode?: "full" | "manual-cap";
}

export interface SpellEffectDefinition {
  id: string;
  spellName: string;
  tier: 1 | 2 | 3 | 4;
  description: string;
  modifiers: Modifier[] | ((context: SpellEffectRuntimeContext) => Modifier[]);
  limitations?: string[];
  tracker?: SpellEffectTrackerDefinition;
}

export interface ResolvedSpellEffect {
  id: string;
  spellName: string;
  tier: 1 | 2 | 3 | 4;
  description: string;
  modifiers: Modifier[];
  limitations?: string[];
  tracker?: {
    label: string;
    max: number;
    seedMode: "full" | "manual-cap";
  };
}

const CORE_PACK = "core";

function effectId(spellName: string) {
  return `spell-${spellName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function modifier(
  spellName: string,
  target: ModifierTarget,
  type: BonusType,
  value: number,
): Modifier {
  return {
    target,
    type,
    value,
    source: spellName,
    pack: CORE_PACK,
  };
}

function trackedEffect(args: {
  spellName: string;
  tier: 1 | 2 | 3 | 4;
  description: string;
  modifiers?: Modifier[] | ((context: SpellEffectRuntimeContext) => Modifier[]);
  limitations?: string[];
  tracker?: SpellEffectTrackerDefinition;
}): SpellEffectDefinition {
  return {
    id: effectId(args.spellName),
    spellName: args.spellName,
    tier: args.tier,
    description: args.description,
    modifiers: args.modifiers ?? [],
    limitations: args.limitations,
    tracker: args.tracker,
  };
}

function fixedAbilityBuff(
  spellName: string,
  tier: 1 | 2,
  ability: "str" | "dex" | "con" | "int" | "wis" | "cha",
  value: number,
  limitations?: string[],
) {
  return trackedEffect({
    spellName,
    tier,
    description: `${value > 0 ? "+" : ""}${value} enhancement bonus to ${ability.toUpperCase()}`,
    modifiers: [modifier(spellName, ability, "enhancement", value)],
    limitations,
  });
}

function fixedAcBuff(
  spellName: string,
  tier: 1 | 2,
  type: BonusType,
  value: number,
  limitations?: string[],
) {
  return trackedEffect({
    spellName,
    tier,
    description: `${value > 0 ? "+" : ""}${value} ${type} bonus to AC`,
    modifiers: [modifier(spellName, "ac", type, value)],
    limitations,
  });
}

export const SPELL_EFFECTS: SpellEffectDefinition[] = [
  trackedEffect({
    spellName: "Aid",
    tier: 2,
    description: "+1 morale bonus to attack; temp HP tracker",
    modifiers: [modifier("Aid", "attack", "morale", 1)],
    limitations: [
      "Fear-specific bonuses are not applied automatically.",
      "Temp HP are modeled as a tracked buffer, not auto-added to the global HP display.",
    ],
    tracker: {
      label: "temp hp buffer",
      max: (context) => Math.min(10, 5 + context.highestCasterLevel),
      seedMode: "manual-cap",
    },
  }),
  fixedAbilityBuff("Bear's Endurance", 1, "con", 4),
  trackedEffect({
    spellName: "Bless",
    tier: 1,
    description: "+1 morale bonus to attack rolls",
    modifiers: [modifier("Bless", "attack", "morale", 1)],
  }),
  trackedEffect({
    spellName: "Blessing of Fervor",
    tier: 3,
    description: "Tracked active state for Blessing of Fervor",
    limitations: [
      "Mode selection remains manual.",
      "Extra attack, stand-up, and speed options are not auto-swapped yet.",
    ],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Blur",
    tier: 3,
    description: "Tracked concealment state from Blur",
    limitations: ["Miss chance is resolved manually."],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  fixedAbilityBuff("Bull's Strength", 1, "str", 4),
  trackedEffect({
    spellName: "Barkskin",
    tier: 2,
    description: "Scaling natural armor bonus to AC",
    modifiers: (context) => [
      modifier(
        "Barkskin",
        "ac",
        "natural-armor",
        Math.min(
          5,
          2 + Math.floor(Math.max(0, context.highestCasterLevel - 3) / 3),
        ),
      ),
    ],
    limitations: ["Scaling uses highest active caster level."],
  }),
  fixedAbilityBuff("Cat's Grace", 1, "dex", 4),
  trackedEffect({
    spellName: "Darkvision",
    tier: 3,
    description: "Tracked active state for Darkvision",
    limitations: ["Vision range remains a manual table concern."],
    tracker: {
      label: "hours remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Displacement",
    tier: 3,
    description: "Tracked concealment state from Displacement",
    limitations: ["Miss chance is resolved manually."],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Divine Favor",
    tier: 2,
    description: "Scaling luck bonus to attack and weapon damage",
    modifiers: (context) => {
      const value = Math.min(
        3,
        Math.max(1, Math.floor((context.highestCasterLevel + 2) / 3)),
      );
      return [
        modifier("Divine Favor", "attack", "luck", value),
        modifier("Divine Favor", "damage", "luck", value),
      ];
    },
    limitations: ["Scaling uses highest active caster level."],
  }),
  trackedEffect({
    spellName: "Divine Power",
    tier: 3,
    description: "Tracked active state for Divine Power",
    limitations: [
      "Temporary hit points, BAB changes, and extra attack handling remain manual.",
    ],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  fixedAbilityBuff("Eagle's Splendor", 1, "cha", 4),
  trackedEffect({
    spellName: "Enlarge Person",
    tier: 3,
    description:
      "One size larger; +2 STR, −2 DEX; size-based combat math and melee damage adjusted",
    modifiers: [modifier("Enlarge Person", "size.person", "size", 1)],
    limitations: [
      "Humanoid eligibility, available space, reach and carried equipment weight are adjudicated by the GM. Unrecognized custom weapon dice require a manual adjustment.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Entangle",
    tier: 4,
    description: "Tracked battlefield-control state for Entangle",
    limitations: [
      "Area placement, ongoing saves, and movement penalties are resolved manually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Expeditious Retreat",
    tier: 1,
    description: "+30 enhancement bonus to speed",
    modifiers: [modifier("Expeditious Retreat", "speed", "enhancement", 30)],
    limitations: ["The spell's movement cap is not enforced automatically."],
  }),
  trackedEffect({
    spellName: "False Life",
    tier: 2,
    description: "Tracked False Life temporary HP buffer",
    limitations: [
      "The exact rolled temp HP should be set manually under the tracker cap.",
    ],
    tracker: {
      label: "temp hp buffer",
      max: (context) => Math.min(20, 10 + context.highestCasterLevel),
      seedMode: "manual-cap",
    },
  }),
  trackedEffect({
    spellName: "Fly",
    tier: 3,
    description: "Tracked active state for Fly",
    limitations: ["Flight speed and maneuverability are resolved manually."],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  fixedAbilityBuff("Fox's Cunning", 1, "int", 4),
  trackedEffect({
    spellName: "Freedom of Movement",
    tier: 3,
    description: "Tracked active state for Freedom of Movement",
    limitations: [
      "Grapple, paralysis, and movement restrictions are resolved manually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Good Hope",
    tier: 1,
    description: "+2 morale bonus to attack, damage, and all saves",
    modifiers: [
      modifier("Good Hope", "attack", "morale", 2),
      modifier("Good Hope", "damage", "morale", 2),
      modifier("Good Hope", "save.all", "morale", 2),
    ],
    limitations: ["Skill bonuses are not applied automatically."],
  }),
  trackedEffect({
    spellName: "Greater Heroism",
    tier: 2,
    description: "+4 morale bonus to attack and all saves; temp HP tracker",
    modifiers: [
      modifier("Greater Heroism", "attack", "morale", 4),
      modifier("Greater Heroism", "save.all", "morale", 4),
    ],
    limitations: [
      "Fear immunity remains manual.",
      "Temporary hit points are modeled as a tracked buffer.",
    ],
    tracker: {
      label: "temp hp buffer",
      max: () => 20,
      seedMode: "manual-cap",
    },
  }),
  trackedEffect({
    spellName: "Greater Invisibility",
    tier: 3,
    description: "Tracked active state for Greater Invisibility",
    limitations: [
      "Visibility, concealment, and attack interaction are resolved manually.",
    ],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Guidance",
    tier: 3,
    description: "Tracked one-use bonus state for Guidance",
    limitations: [
      "The +1 competence bonus is assigned manually to the next relevant roll.",
    ],
    tracker: {
      label: "uses remaining",
      max: () => 1,
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Haste",
    tier: 2,
    description: "+1 attack, +1 dodge AC, +1 Reflex, +30 enhancement speed",
    modifiers: [
      modifier("Haste", "attack", "untyped", 1),
      modifier("Haste", "ac", "dodge", 1),
      modifier("Haste", "save.ref", "untyped", 1),
      modifier("Haste", "speed", "enhancement", 30),
    ],
    limitations: [
      "The extra attack is tracked manually.",
      "The spell's movement cap is not enforced automatically.",
    ],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Heroism",
    tier: 1,
    description: "+2 morale bonus to attack and all saves",
    modifiers: [
      modifier("Heroism", "attack", "morale", 2),
      modifier("Heroism", "save.all", "morale", 2),
    ],
    limitations: ["Skill bonuses are not applied automatically."],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel * 10),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Invisibility",
    tier: 3,
    description: "Tracked active state for Invisibility",
    limitations: [
      "Visibility, stealth, and attack interaction are resolved manually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Longstrider",
    tier: 1,
    description: "+10 enhancement bonus to speed",
    modifiers: [modifier("Longstrider", "speed", "enhancement", 10)],
    tracker: {
      label: "hours remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  fixedAcBuff("Mage Armor", 1, "armor", 4),
  trackedEffect({
    spellName: "Magic Fang",
    tier: 2,
    description: "Enhancement bonus to attack and damage",
    modifiers: (context) => {
      const value =
        context.highestCasterLevel >= 12
          ? 3
          : context.highestCasterLevel >= 9
            ? 2
            : 1;
      return [
        modifier("Magic Fang", "attack", "enhancement", value),
        modifier("Magic Fang", "damage", "enhancement", value),
      ];
    },
    limitations: [
      "Greater Magic Fang scaling is approximated here for broad runtime support.",
      "Applies specifically to natural attacks, not all weapons.",
    ],
  }),
  trackedEffect({
    spellName: "Magic Weapon",
    tier: 2,
    description: "Enhancement bonus to attack and damage",
    modifiers: (context) => {
      const value =
        context.highestCasterLevel >= 12
          ? 3
          : context.highestCasterLevel >= 9
            ? 2
            : 1;
      return [
        modifier("Magic Weapon", "attack", "enhancement", value),
        modifier("Magic Weapon", "damage", "enhancement", value),
      ];
    },
    limitations: [
      "Greater Magic Weapon scaling is approximated here for broad runtime support.",
      "Applies specifically to one weapon, not all attacks.",
    ],
  }),
  trackedEffect({
    spellName: "Mirror Image",
    tier: 2,
    description: "Tracked image pool for Mirror Image",
    limitations: [
      "Set the actual rolled image count manually under the displayed cap.",
      "Hit resolution against images is handled manually.",
    ],
    tracker: {
      label: "images remaining",
      max: (context) =>
        Math.min(8, 4 + Math.floor(context.highestCasterLevel / 3)),
      seedMode: "manual-cap",
    },
  }),
  fixedAbilityBuff("Owl's Wisdom", 1, "wis", 4),
  trackedEffect({
    spellName: "Prayer",
    tier: 1,
    description: "+1 luck bonus to attack, damage, and all saves",
    modifiers: [
      modifier("Prayer", "attack", "luck", 1),
      modifier("Prayer", "damage", "luck", 1),
      modifier("Prayer", "save.all", "luck", 1),
    ],
    limitations: ["Skill bonuses and enemy penalties are resolved manually."],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Protection from Energy",
    tier: 2,
    description: "Tracked absorbed-energy pool for Protection from Energy",
    limitations: ["Choose the relevant energy type manually."],
    tracker: {
      label: "energy buffer",
      max: (context) => Math.min(120, context.highestCasterLevel * 12),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Protection from Evil",
    tier: 3,
    description: "Tracked active state for Protection from Evil",
    limitations: [
      "Bonuses apply only against evil sources and are resolved manually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Reduce Person",
    tier: 3,
    description:
      "One size smaller; +2 DEX, −2 STR; size-based combat math and weapon damage adjusted",
    modifiers: [modifier("Reduce Person", "size.person", "size", -1)],
    limitations: [
      "Humanoid eligibility, reach and carried equipment weight are adjudicated by the GM. Unrecognized custom weapon dice require a manual adjustment.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Resist Energy",
    tier: 3,
    description: "Tracked active resistance state for Resist Energy",
    limitations: [
      "Choose the energy type manually; resistance amount is tracked conceptually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel * 10),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Resistance",
    tier: 1,
    description: "+1 resistance bonus on all saves",
    modifiers: [modifier("Resistance", "save.all", "resistance", 1)],
  }),
  trackedEffect({
    spellName: "Sanctuary",
    tier: 3,
    description: "Tracked protective state for Sanctuary",
    limitations: ["Will save gating and attack-break conditions are manual."],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "See Invisibility",
    tier: 3,
    description: "Tracked active state for See Invisibility",
    limitations: ["Detection and target visibility are resolved manually."],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel * 10),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Shield",
    tier: 1,
    description: "+4 shield bonus to AC",
    modifiers: [modifier("Shield", "ac", "shield", 4)],
    limitations: ["Magic Missile negation is resolved manually."],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Shield of Faith",
    tier: 2,
    description: "Scaling deflection bonus to AC",
    modifiers: (context) => [
      modifier(
        "Shield of Faith",
        "ac",
        "deflection",
        Math.min(
          5,
          2 + Math.floor(Math.max(0, context.highestCasterLevel - 6) / 6),
        ),
      ),
    ],
    limitations: ["Scaling uses highest active caster level."],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Shield Other",
    tier: 3,
    description: "Tracked active state for Shield Other",
    limitations: ["Damage sharing is resolved manually."],
    tracker: {
      label: "hours remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Silence",
    tier: 4,
    description: "Tracked battlefield-control state for Silence",
    limitations: [
      "Area placement, anchoring, and speech/spellcasting suppression are resolved manually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Stoneskin",
    tier: 2,
    description: "Tracked DR pool for Stoneskin",
    limitations: ["Material component consumption is resolved manually."],
    tracker: {
      label: "damage absorption",
      max: (context) => Math.min(150, context.highestCasterLevel * 10),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Summon Monster",
    tier: 4,
    description: "Tracked encounter-summon state for Summon Monster",
    limitations: [
      "Creature selection, actions, attacks, and board position are resolved manually.",
    ],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "True Strike",
    tier: 3,
    description: "+20 insight bonus to attack rolls",
    modifiers: [modifier("True Strike", "attack", "insight", 20)],
    limitations: ["Applies only to the next single attack."],
    tracker: {
      label: "uses remaining",
      max: () => 1,
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Virtue",
    tier: 2,
    description: "Tracked Virtue temporary HP buffer",
    limitations: ["The spell's 1 temporary hit point is tracked as a buffer."],
    tracker: {
      label: "temp hp buffer",
      max: () => 1,
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Web",
    tier: 4,
    description: "Tracked battlefield-control state for Web",
    limitations: [
      "Area placement, grapple checks, burning, and movement restriction are resolved manually.",
    ],
    tracker: {
      label: "minutes remaining",
      max: (context) => Math.max(1, context.highestCasterLevel * 10),
      seedMode: "full",
    },
  }),
  trackedEffect({
    spellName: "Black Tentacles",
    tier: 4,
    description: "Tracked battlefield-control state for Black Tentacles",
    limitations: [
      "Area placement, grapple checks, and per-target resolution are resolved manually.",
    ],
    tracker: {
      label: "rounds remaining",
      max: (context) => Math.max(1, context.highestCasterLevel),
      seedMode: "full",
    },
  }),
];

export function resolveSpellEffect(
  effect: SpellEffectDefinition,
  context: SpellEffectRuntimeContext,
): ResolvedSpellEffect {
  const tracker = effect.tracker
    ? {
        label: effect.tracker.label,
        max: Math.max(1, Math.floor(effect.tracker.max(context))),
        seedMode: effect.tracker.seedMode ?? "full",
      }
    : undefined;
  return {
    id: effect.id,
    spellName: effect.spellName,
    tier: effect.tier,
    description: effect.description,
    modifiers:
      typeof effect.modifiers === "function"
        ? effect.modifiers(context)
        : effect.modifiers,
    limitations: effect.limitations,
    tracker,
  };
}

export function spellEffectResourceMax(
  effect: SpellEffectDefinition,
  context: SpellEffectRuntimeContext,
): number | undefined {
  return effect.tracker
    ? resolveSpellEffect(effect, context).tracker?.max
    : undefined;
}

export function spellEffectResourceLabel(
  effect: SpellEffectDefinition,
): string | undefined {
  return effect.tracker?.label;
}

export function spellEffectCoverageSummary() {
  const byTier = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  } as Record<1 | 2 | 3 | 4, number>;
  let trackerCount = 0;
  for (const effect of SPELL_EFFECTS) {
    byTier[effect.tier] += 1;
    if (effect.tracker) trackerCount += 1;
  }
  return {
    total: SPELL_EFFECTS.length,
    byTier,
    trackerCount,
  };
}

export const SPELL_EFFECTS_BY_ID: Record<string, SpellEffectDefinition> =
  Object.fromEntries(SPELL_EFFECTS.map((effect) => [effect.id, effect]));

export const SPELL_EFFECTS_BY_NAME: Record<string, SpellEffectDefinition> =
  Object.fromEntries(
    SPELL_EFFECTS.map((effect) => [effect.spellName.toLowerCase(), effect]),
  );

export function getSpellEffect(id: string): SpellEffectDefinition | undefined {
  return SPELL_EFFECTS_BY_ID[id];
}

export function getSpellEffectByName(
  spellName: string,
): SpellEffectDefinition | undefined {
  return SPELL_EFFECTS_BY_NAME[spellName.toLowerCase()];
}
