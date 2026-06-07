import type { CharacterBuild, LevelEntry, Modifier } from "@path-builder/rules-engine";

/** Starting character: a fresh level-1 Half-Orc Barbarian. */
export const initialBuild: CharacterBuild = {
  name: "Grukk",
  race: {
    name: "Half-Orc",
    size: "medium",
    speed: 30,
    abilityModifiers: [
      { target: "str", type: "racial", value: 2, source: "Half-Orc" },
    ],
  },
  baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  levels: [
    {
      className: "Barbarian",
      hitPointRoll: 12,
      skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
      feats: ["Toughness"],
      features: ["Rage", "Fast Movement"],
      modifiers: [
        { target: "hp", type: "untyped", value: 3, source: "Toughness" },
        { target: "speed", type: "untyped", value: 10, source: "Fast Movement" },
      ],
    },
  ],
};

/** Template used by the "Level Up" button (a +7 HP Barbarian level). */
export const nextBarbarianLevel: Omit<LevelEntry, "hitPointRoll"> & { hitPointRoll: number } = {
  className: "Barbarian",
  hitPointRoll: 7,
  skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
};

export interface Buff {
  id: string;
  name: string;
  description: string;
  modifiers: Modifier[];
}

/**
 * Toggleable party buffs / auras. Each is just a bundle of Modifiers appended
 * to the sheet at runtime — exactly how the DM's aura broadcast will work.
 */
export const BUFFS: Buff[] = [
  {
    id: "rage",
    name: "Rage (class ability)",
    description: "+2 morale Str & Con, +2 Will, -2 AC",
    modifiers: [
      { target: "str", type: "morale", value: 2, source: "Rage" },
      { target: "con", type: "morale", value: 2, source: "Rage" },
      { target: "save.will", type: "morale", value: 2, source: "Rage" },
      { target: "ac", type: "untyped", value: -2, source: "Rage" },
    ],
  },
  {
    id: "bless",
    name: "Bless",
    description: "+1 morale to attack rolls",
    modifiers: [{ target: "attack", type: "morale", value: 1, source: "Bless" }],
  },
  {
    id: "heroism",
    name: "Heroism",
    description: "+2 morale to attacks and all saves",
    modifiers: [
      { target: "attack", type: "morale", value: 2, source: "Heroism" },
      { target: "save.all", type: "morale", value: 2, source: "Heroism" },
    ],
  },
  {
    id: "mage-armor",
    name: "Mage Armor",
    description: "+4 armor bonus to AC",
    modifiers: [{ target: "ac", type: "armor", value: 4, source: "Mage Armor" }],
  },
  {
    id: "shield-of-faith",
    name: "Shield of Faith",
    description: "+2 deflection bonus to AC",
    modifiers: [{ target: "ac", type: "deflection", value: 2, source: "Shield of Faith" }],
  },
  {
    id: "haste",
    name: "Haste",
    description: "+1 to attack, +1 dodge to AC",
    modifiers: [
      { target: "attack", type: "untyped", value: 1, source: "Haste" },
      { target: "ac", type: "dodge", value: 1, source: "Haste" },
    ],
  },
];
