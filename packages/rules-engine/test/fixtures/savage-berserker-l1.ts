import type { CharacterInput } from "../../src/types";

/**
 * Golden fixture: a Level 1 martial character with a representative pile of
 * modifiers chosen to exercise the tricky parts of the engine:
 *
 *  - enhancement bonus to an ability score (Belt of Giant Strength +2)
 *  - armor + shield + dodge bonuses to AC (touch/flat-footed exclusions)
 *  - a take-highest morale conflict on attacks (Bless +1 vs Heroism +2)
 *  - a group buff to all saves (Heroism +2 morale)
 *  - an untyped attack bonus (Weapon Focus)
 *
 * NOTE: the math here is standard Pathfinder 1e (Savage Company is PF1e-
 * compatible). Real Savage Company class/feat data will replace the flavor
 * once the content pack lands; the NUMBERS stay verifiable from the core rules.
 */
export const savageBerserkerL1: CharacterInput = {
  name: "Brakka, Savage Company Berserker",
  level: 1,
  size: "medium",
  baseAttackBonus: 1,
  baseSaves: { fort: 2, ref: 0, will: 0 },
  maxDexBonus: 3, // scale mail
  armorCheckPenalty: 6, // scale mail (-4) + heavy steel shield (-2)
  baseSpeed: 30,
  rolledHitPoints: [12], // max d12 at level 1
  abilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  classSkills: [
    "climb",
    "swim",
    "intimidate",
    "perception",
    "stealth",
    "survival",
  ],
  skillRanks: { climb: 1, perception: 1, stealth: 1, intimidate: 1 },
  modifiers: [
    // Gear
    {
      target: "str",
      type: "enhancement",
      value: 2,
      source: "Belt of Giant Strength +2",
      pack: "core",
    },
    {
      target: "ac",
      type: "armor",
      value: 5,
      source: "Scale mail",
      pack: "core",
    },
    {
      target: "ac",
      type: "shield",
      value: 2,
      source: "Heavy steel shield",
      pack: "core",
    },
    // Feats
    { target: "ac", type: "dodge", value: 1, source: "Dodge", pack: "core" },
    {
      target: "attack.melee",
      type: "untyped",
      value: 1,
      source: "Weapon Focus (longsword)",
      pack: "core",
    },
    // Vitals
    {
      target: "hp",
      type: "untyped",
      value: 3,
      source: "Toughness",
      pack: "core",
    },
    {
      target: "speed",
      type: "untyped",
      value: -10,
      source: "Scale mail (medium armor)",
      pack: "core",
    },
    // Buffs / auras
    {
      target: "attack",
      type: "morale",
      value: 1,
      source: "Bless",
      pack: "core",
    },
    {
      target: "attack",
      type: "morale",
      value: 2,
      source: "Heroism",
      pack: "core",
    },
    {
      target: "save.all",
      type: "morale",
      value: 2,
      source: "Heroism",
      pack: "core",
    },
  ],
};
