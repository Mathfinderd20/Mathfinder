import {
  getCachedCompendiumIndex,
  getCompendiumEntryByName,
  type CompendiumIndex,
} from "../compendium";

export interface SpellClassLevel {
  className: string;
  level: number;
}

export interface SpellDefinition {
  id: string;
  name: string;
  pack: string;
  school?: string;
  classes: SpellClassLevel[];
  description?: string;
  source?: string;
  sourceUrl?: string;
}

export type SpellRegistry = Record<string, SpellDefinition>;

export const CORE_SPELLS: SpellDefinition[] = [
  {
    id: "detect-magic",
    name: "Detect Magic",
    pack: "core",
    school: "divination",
    classes: [
      { className: "wizard", level: 0 },
      { className: "sorcerer", level: 0 },
      { className: "cleric", level: 0 },
      { className: "druid", level: 0 },
      { className: "bard", level: 0 },
    ],
  },
  {
    id: "read-magic",
    name: "Read Magic",
    pack: "core",
    school: "divination",
    classes: [
      { className: "wizard", level: 0 },
      { className: "sorcerer", level: 0 },
      { className: "bard", level: 0 },
    ],
  },
  {
    id: "acid-splash",
    name: "Acid Splash",
    pack: "core",
    school: "conjuration",
    classes: [
      { className: "wizard", level: 0 },
      { className: "sorcerer", level: 0 },
    ],
  },
  {
    id: "mage-hand",
    name: "Mage Hand",
    pack: "core",
    school: "transmutation",
    classes: [
      { className: "wizard", level: 0 },
      { className: "sorcerer", level: 0 },
      { className: "bard", level: 0 },
    ],
  },
  {
    id: "daze",
    name: "Daze",
    pack: "core",
    school: "enchantment",
    classes: [
      { className: "wizard", level: 0 },
      { className: "sorcerer", level: 0 },
      { className: "bard", level: 0 },
    ],
  },
  {
    id: "guidance",
    name: "Guidance",
    pack: "core",
    school: "divination",
    classes: [
      { className: "cleric", level: 0 },
      { className: "druid", level: 0 },
    ],
  },
  {
    id: "light",
    name: "Light",
    pack: "core",
    school: "evocation",
    classes: [
      { className: "cleric", level: 0 },
      { className: "druid", level: 0 },
      { className: "bard", level: 0 },
      { className: "wizard", level: 0 },
      { className: "sorcerer", level: 0 },
    ],
  },
  {
    id: "resistance",
    name: "Resistance",
    pack: "core",
    school: "abjuration",
    classes: [
      { className: "cleric", level: 0 },
      { className: "druid", level: 0 },
      { className: "bard", level: 0 },
    ],
  },
  {
    id: "silent-image",
    name: "Silent Image",
    pack: "core",
    school: "illusion",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
      { className: "bard", level: 1 },
    ],
  },
  {
    id: "burning-hands",
    name: "Burning Hands",
    pack: "core",
    school: "evocation",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
    ],
  },
  {
    id: "protection-from-evil",
    name: "Protection from Evil",
    pack: "core",
    school: "abjuration",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
      { className: "cleric", level: 1 },
      { className: "paladin", level: 1 },
      { className: "inquisitor", level: 1 },
    ],
  },
  {
    id: "magic-weapon",
    name: "Magic Weapon",
    pack: "core",
    school: "transmutation",
    classes: [
      { className: "cleric", level: 1 },
      { className: "paladin", level: 1 },
      { className: "inquisitor", level: 1 },
    ],
  },
  {
    id: "longstrider",
    name: "Longstrider",
    pack: "core",
    school: "transmutation",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
      { className: "druid", level: 1 },
      { className: "bard", level: 1 },
    ],
  },
  {
    id: "mage-armor",
    name: "Mage Armor",
    pack: "core",
    school: "conjuration",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
    ],
  },
  {
    id: "magic-missile",
    name: "Magic Missile",
    pack: "core",
    school: "evocation",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
    ],
  },
  {
    id: "shield",
    name: "Shield",
    pack: "core",
    school: "abjuration",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
    ],
  },
  {
    id: "color-spray",
    name: "Color Spray",
    pack: "core",
    school: "illusion",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
    ],
  },
  {
    id: "grease",
    name: "Grease",
    pack: "core",
    school: "conjuration",
    classes: [
      { className: "wizard", level: 1 },
      { className: "sorcerer", level: 1 },
      { className: "bard", level: 1 },
    ],
  },
  {
    id: "invisibility",
    name: "Invisibility",
    pack: "core",
    school: "illusion",
    classes: [
      { className: "wizard", level: 2 },
      { className: "sorcerer", level: 2 },
    ],
  },
  {
    id: "blur",
    name: "Blur",
    pack: "core",
    school: "illusion",
    classes: [
      { className: "wizard", level: 2 },
      { className: "sorcerer", level: 2 },
    ],
  },
  {
    id: "scorching-ray",
    name: "Scorching Ray",
    pack: "core",
    school: "evocation",
    classes: [
      { className: "wizard", level: 2 },
      { className: "sorcerer", level: 2 },
    ],
  },
  {
    id: "resist-energy",
    name: "Resist Energy",
    pack: "core",
    school: "abjuration",
    classes: [
      { className: "wizard", level: 2 },
      { className: "sorcerer", level: 2 },
      { className: "cleric", level: 2 },
      { className: "druid", level: 2 },
      { className: "bard", level: 2 },
      { className: "paladin", level: 2 },
      { className: "inquisitor", level: 2 },
    ],
  },
  {
    id: "bless",
    name: "Bless",
    pack: "core",
    school: "enchantment",
    classes: [{ className: "cleric", level: 1 }],
  },
  {
    id: "cure-light-wounds",
    name: "Cure Light Wounds",
    pack: "core",
    school: "conjuration",
    classes: [
      { className: "cleric", level: 1 },
      { className: "druid", level: 1 },
      { className: "bard", level: 1 },
    ],
  },
  {
    id: "shield-of-faith",
    name: "Shield of Faith",
    pack: "core",
    school: "abjuration",
    classes: [
      { className: "cleric", level: 1 },
      { className: "paladin", level: 1 },
      { className: "inquisitor", level: 1 },
    ],
  },
  {
    id: "aid",
    name: "Aid",
    pack: "core",
    school: "enchantment",
    classes: [
      { className: "cleric", level: 2 },
      { className: "paladin", level: 2 },
      { className: "inquisitor", level: 2 },
    ],
  },
  {
    id: "bulls-strength",
    name: "Bull's Strength",
    pack: "core",
    school: "transmutation",
    classes: [
      { className: "cleric", level: 2 },
      { className: "druid", level: 2 },
      { className: "bard", level: 2 },
      { className: "paladin", level: 2 },
      { className: "ranger", level: 2 },
      { className: "inquisitor", level: 2 },
    ],
  },
  {
    id: "entangle",
    name: "Entangle",
    pack: "core",
    school: "transmutation",
    classes: [
      { className: "druid", level: 1 },
      { className: "ranger", level: 1 },
    ],
  },
  {
    id: "magic-fang",
    name: "Magic Fang",
    pack: "core",
    school: "transmutation",
    classes: [{ className: "druid", level: 1 }],
  },
  {
    id: "barkskin",
    name: "Barkskin",
    pack: "core",
    school: "transmutation",
    classes: [
      { className: "druid", level: 2 },
      { className: "ranger", level: 2 },
    ],
  },
  {
    id: "flaming-sphere",
    name: "Flaming Sphere",
    pack: "core",
    school: "evocation",
    classes: [{ className: "druid", level: 2 }],
  },
  {
    id: "charm-person",
    name: "Charm Person",
    pack: "core",
    school: "enchantment",
    classes: [{ className: "bard", level: 1 }],
  },
  {
    id: "hideous-laughter",
    name: "Hideous Laughter",
    pack: "core",
    school: "enchantment",
    classes: [{ className: "bard", level: 2 }],
  },
  {
    id: "divine-favor",
    name: "Divine Favor",
    pack: "core",
    school: "evocation",
    classes: [
      { className: "cleric", level: 1 },
      { className: "paladin", level: 1 },
      { className: "inquisitor", level: 1 },
    ],
  },
  {
    id: "detect-evil",
    name: "Detect Evil",
    pack: "core",
    school: "divination",
    classes: [
      { className: "paladin", level: 1 },
      { className: "inquisitor", level: 1 },
    ],
  },
  {
    id: "bless-weapon",
    name: "Bless Weapon",
    pack: "core",
    school: "transmutation",
    classes: [{ className: "paladin", level: 1 }],
  },
  {
    id: "doom",
    name: "Doom",
    pack: "core",
    school: "necromancy",
    classes: [
      { className: "cleric", level: 1 },
      { className: "inquisitor", level: 1 },
    ],
  },
  {
    id: "gravity-bow",
    name: "Gravity Bow",
    pack: "core",
    school: "transmutation",
    classes: [{ className: "ranger", level: 1 }],
  },
  {
    id: "aspect-of-the-falcon",
    name: "Aspect of the Falcon",
    pack: "core",
    school: "transmutation",
    classes: [{ className: "ranger", level: 1 }],
  },
  {
    id: "lead-blades",
    name: "Lead Blades",
    pack: "core",
    school: "transmutation",
    classes: [{ className: "ranger", level: 1 }],
  },
  {
    id: "cure-moderate-wounds",
    name: "Cure Moderate Wounds",
    pack: "core",
    school: "conjuration",
    classes: [
      { className: "cleric", level: 2 },
      { className: "druid", level: 2 },
      { className: "bard", level: 2 },
      { className: "paladin", level: 2 },
      { className: "inquisitor", level: 2 },
    ],
  },
  {
    id: "delay-poison",
    name: "Delay Poison",
    pack: "core",
    school: "conjuration",
    classes: [
      { className: "druid", level: 2 },
      { className: "ranger", level: 2 },
      { className: "paladin", level: 2 },
      { className: "inquisitor", level: 2 },
    ],
  },
  {
    id: "hold-person",
    name: "Hold Person",
    pack: "core",
    school: "enchantment",
    classes: [
      { className: "bard", level: 2 },
      { className: "inquisitor", level: 2 },
    ],
  },
];

export const SAVAGE_COMPANY_SPELLS: SpellDefinition[] = [];

export function buildSpellRegistry(
  ...packs: SpellDefinition[][]
): SpellRegistry {
  return Object.fromEntries(
    packs.flat().map((spell) => [spell.name.toLowerCase(), spell]),
  );
}

export const SPELLS: SpellRegistry = buildSpellRegistry(
  CORE_SPELLS,
  SAVAGE_COMPANY_SPELLS,
);

export function spellCompendiumIndex(
  registry: SpellRegistry,
): CompendiumIndex<SpellDefinition> {
  return getCachedCompendiumIndex(registry, () => Object.values(registry));
}

export const SPELL_INDEX = spellCompendiumIndex(SPELLS);

export function getSpell(
  registry: SpellRegistry,
  name: string,
): SpellDefinition | undefined {
  return getCompendiumEntryByName(spellCompendiumIndex(registry), name);
}

export function classSpellLevel(
  spell: SpellDefinition,
  className: string,
): number | undefined {
  return spell.classes.find(
    (c) => c.className.toLowerCase() === className.toLowerCase(),
  )?.level;
}
