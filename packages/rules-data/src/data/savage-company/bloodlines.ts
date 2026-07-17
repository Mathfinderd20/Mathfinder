import type { BloodlineDefinition } from "../../types";

export const SAVAGE_COMPANY_BLOODLINES: BloodlineDefinition[] = [
  {
    id: "war-orphan",
    name: "War Orphan",
    pack: "savage-company",
    baseClassName: "Sorcerer",
    description:
      "A sorcerer bloodline forged by personal or familial trauma from warfare, emphasizing battle-casting, survival, and unshakable focus.",
    classSkill: "survival",
    bonusSpells: [
      "Stone Shield",
      "Iron Skin",
      "Rage",
      "Wall of Fire",
      "Cloudkill",
      "Wall of Pikes",
      "Delayed Blast Fireball",
      "Iron Body",
      "Meteor Swarm",
    ],
    bonusFeats: [
      "Diehard",
      "Endurance",
      "Toughness",
      "Combat Casting",
      "Spell Penetration",
      "Defensive Combat Training",
      "Improved Initiative",
      "Quicken Spell",
    ],
    arcana:
      "Gain half sorcerer level as a deflection bonus to AC while unarmored.",
    powers: [
      {
        level: 1,
        name: "Decisive Celerity",
        summary:
          "When an enemy moves adjacent, immediately move up to your speed without provoking, usable Cha modifier times per day.",
      },
      {
        level: 3,
        name: "Penetrating Determination",
        summary:
          "+4 to concentration checks and caster level checks to overcome spell resistance, improving to +6 at 9th.",
      },
      {
        level: 9,
        name: "Stubborn Fortitude",
        summary:
          "Gain a scaling inherent Constitution bonus: +2 at 9th, +4 at 13th, +6 at 17th.",
      },
      {
        level: 15,
        name: "Cunning Manipulation",
        summary:
          "Gain invisible incorporeal hands that emulate spectral hand for touch spells and constant mage hand utility.",
      },
      {
        level: 20,
        name: "Overpowering Will",
        summary:
          "Ignore verbal components, foil Spellcraft identification, auto-succeed concentration checks, and gain DR 5/- plus blindsight 90 ft.",
      },
    ],
  },
];
