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
}

export type SpellRegistry = Record<string, SpellDefinition>;

export const CORE_SPELLS: SpellDefinition[] = [
  { id: "detect-magic", name: "Detect Magic", pack: "core", school: "divination", classes: [
    { className: "wizard", level: 0 },
    { className: "sorcerer", level: 0 },
    { className: "cleric", level: 0 },
  ] },
  { id: "read-magic", name: "Read Magic", pack: "core", school: "divination", classes: [
    { className: "wizard", level: 0 },
    { className: "sorcerer", level: 0 },
  ] },
  { id: "acid-splash", name: "Acid Splash", pack: "core", school: "conjuration", classes: [
    { className: "wizard", level: 0 },
    { className: "sorcerer", level: 0 },
  ] },
  { id: "mage-hand", name: "Mage Hand", pack: "core", school: "transmutation", classes: [
    { className: "wizard", level: 0 },
    { className: "sorcerer", level: 0 },
  ] },
  { id: "daze", name: "Daze", pack: "core", school: "enchantment", classes: [
    { className: "wizard", level: 0 },
    { className: "sorcerer", level: 0 },
  ] },
  { id: "mage-armor", name: "Mage Armor", pack: "core", school: "conjuration", classes: [
    { className: "wizard", level: 1 },
    { className: "sorcerer", level: 1 },
  ] },
  { id: "magic-missile", name: "Magic Missile", pack: "core", school: "evocation", classes: [
    { className: "wizard", level: 1 },
    { className: "sorcerer", level: 1 },
  ] },
  { id: "shield", name: "Shield", pack: "core", school: "abjuration", classes: [
    { className: "wizard", level: 1 },
    { className: "sorcerer", level: 1 },
  ] },
  { id: "grease", name: "Grease", pack: "core", school: "conjuration", classes: [
    { className: "wizard", level: 1 },
    { className: "sorcerer", level: 1 },
  ] },
  { id: "bless", name: "Bless", pack: "core", school: "enchantment", classes: [
    { className: "cleric", level: 1 },
  ] },
  { id: "cure-light-wounds", name: "Cure Light Wounds", pack: "core", school: "conjuration", classes: [
    { className: "cleric", level: 1 },
  ] },
];

export const SAVAGE_COMPANY_SPELLS: SpellDefinition[] = [];

export function buildSpellRegistry(...packs: SpellDefinition[][]): SpellRegistry {
  const registry: SpellRegistry = {};
  for (const pack of packs) {
    for (const spell of pack) registry[spell.name.toLowerCase()] = spell;
  }
  return registry;
}

export const SPELLS: SpellRegistry = buildSpellRegistry(CORE_SPELLS, SAVAGE_COMPANY_SPELLS);

export function getSpell(registry: SpellRegistry, name: string): SpellDefinition | undefined {
  return registry[name.toLowerCase()];
}

export function classSpellLevel(
  spell: SpellDefinition,
  className: string,
): number | undefined {
  return spell.classes.find((c) => c.className.toLowerCase() === className.toLowerCase())?.level;
}
