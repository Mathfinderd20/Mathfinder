import type { RaceDefinition } from "../../types";

const PACK = "savage-company" as const;

export const SAVAGE_COMPANY_RACES: RaceDefinition[] = [
  {
    id: "baade",
    name: "Baade",
    pack: PACK,
    size: "medium",
    speed: 30,
    abilityModifiers: [
      { target: "str", type: "racial", value: 4, source: "Baade", pack: PACK },
      { target: "con", type: "racial", value: 2, source: "Baade", pack: PACK },
      { target: "cha", type: "racial", value: -2, source: "Baade", pack: PACK },
    ],
    traits: [
      {
        target: "save.will",
        type: "racial",
        value: 2,
        source: "Fearless",
        pack: PACK,
        condition: "vs fear",
      },
      {
        target: "skill.survival",
        type: "racial",
        value: 1,
        source: "Baade Skill Bonus",
        pack: PACK,
      },
      {
        target: "skill.diplomacy",
        type: "racial",
        value: 1,
        source: "Baade Skill Bonus",
        pack: PACK,
      },
    ],
    classSkills: ["survival", "diplomacy"],
    senses: {
      darkvisionFeet: 60,
      lowLightVision: true,
    },
    alternateTraits: [
      {
        id: "baade-gore",
        name: "Gore",
        description:
          "Gain a gore natural attack that deals 1d6 damage. If used as part of a full attack, it functions as a secondary natural attack.",
        replaces: ["Fearless"],
        grantedWeapons: [
          {
            name: "Gore",
            category: "melee",
            damageDice: "1d6",
            handedness: "light",
            damageTypes: ["piercing"],
            specialTags: ["natural"],
          },
        ],
        notes: [
          "Baade Gore is secondary when used as part of a full attack; that usage nuance is not modeled separately yet.",
        ],
      },
      {
        id: "baade-pass-for-human",
        name: "Pass for Human",
        description:
          "Hornless, smaller-featured baade can pass as human without needing disguise checks.",
        replaces: ["Fearless"],
        notes: [
          "Pass for Human removes the base Fearless trait and grants a social/disguise exception that is not currently automated.",
        ],
      },
      {
        id: "baade-oversized-limbs",
        name: "Oversized Limbs",
        description:
          "Reduce the penalty for using oversized weapons by 2, to a minimum of 0.",
        replaces: ["Scent"],
        notes: [
          "Oversized Limbs changes oversized-weapon penalties, which the current engine does not model yet.",
        ],
      },
      {
        id: "baade-canny",
        name: "Canny",
        description:
          "Some baade are especially adept with people but brash, gaining +2 Charisma and taking a -2 penalty on Will saves.",
        abilityModifiers: [
          {
            target: "cha",
            type: "racial",
            value: 2,
            source: "Canny",
            pack: PACK,
          },
        ],
        traits: [
          {
            target: "save.will",
            type: "racial",
            value: -2,
            source: "Canny",
            pack: PACK,
          },
        ],
        notes: [
          "Canny is presented in the source without an explicit replacement line; imported as an optional alternate profile adjustment.",
        ],
      },
      {
        id: "baade-silvertongued",
        name: "Silvertongued",
        description:
          "Lose the Baade Diplomacy bonus and social training, gaining the same bonus and class-skill training for Bluff instead.",
        traits: [
          {
            target: "skill.diplomacy",
            type: "racial",
            value: -1,
            source: "Silvertongued",
            pack: PACK,
          },
          {
            target: "skill.bluff",
            type: "racial",
            value: 1,
            source: "Silvertongued",
            pack: PACK,
          },
        ],
        classSkills: ["bluff"],
        notes: [
          "Silvertongued should replace Baade Diplomacy training/bonus with Bluff. The engine can add Bluff here, but does not yet support removing a base class skill entry.",
        ],
      },
    ],
    notes: [
      "Baade are proud nomadic traders and craftsmen, often recognized by their imposing build and horns.",
      "Baade begin speaking Common and Baadan. Bonus language selection is not modeled yet.",
      "Baade have the scent ability, which is noted but not automated by the current engine.",
    ],
  },
  {
    id: "kemano",
    name: "Kemano",
    pack: PACK,
    size: "medium",
    speed: 30,
    abilityModifiers: [
      {
        target: "dex",
        type: "racial",
        value: 2,
        source: "Lagomorph Heritage",
        pack: PACK,
      },
      {
        target: "wis",
        type: "racial",
        value: -2,
        source: "Lagomorph Heritage",
        pack: PACK,
      },
      {
        target: "cha",
        type: "racial",
        value: 2,
        source: "Lagomorph Heritage",
        pack: PACK,
      },
    ],
    traits: [
      {
        target: "save.will",
        type: "racial",
        value: 2,
        source: "Stubborn Mind",
        pack: PACK,
        condition:
          "vs charm, compulsion, and mind-affecting divination effects",
      },
      {
        target: "skill.disguise",
        type: "racial",
        value: 10,
        source: "Pass for Human",
        pack: PACK,
        condition: "when disguising as a human",
      },
      {
        target: "init",
        type: "untyped",
        value: 4,
        source: "Quick Reactions",
        pack: PACK,
      },
    ],
    senses: { lowLightVision: true },
    alternateTraits: [
      {
        id: "kemano-canine-heritage",
        name: "Canine Heritage",
        description:
          "Replace lagomorph heritage with canine traits: +2 Con, -2 Int, +2 Wis, plus canine bite/scent themes.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "dex",
            type: "racial",
            value: -2,
            source: "Canine Heritage",
            pack: PACK,
          },
          {
            target: "wis",
            type: "racial",
            value: 4,
            source: "Canine Heritage",
            pack: PACK,
          },
          {
            target: "cha",
            type: "racial",
            value: -2,
            source: "Canine Heritage",
            pack: PACK,
          },
          {
            target: "con",
            type: "racial",
            value: 2,
            source: "Canine Heritage",
            pack: PACK,
          },
          {
            target: "int",
            type: "racial",
            value: -2,
            source: "Canine Heritage",
            pack: PACK,
          },
        ],
        grantedWeapons: [
          {
            name: "Bite",
            category: "melee",
            damageDice: "1d3",
            handedness: "light",
            damageTypes: ["piercing"],
            specialTags: ["natural"],
          },
        ],
        notes: [
          "Canine Heritage also grants Endurance and scent; those are not fully automated in the current engine.",
        ],
      },
      {
        id: "kemano-dromedary-heritage",
        name: "Dromedary Heritage",
        description:
          "Replace lagomorph heritage with dromedary traits: +2 Con, +2 Wis, -2 Cha, relentless, and ant haul.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "dex",
            type: "racial",
            value: -2,
            source: "Dromedary Heritage",
            pack: PACK,
          },
          {
            target: "wis",
            type: "racial",
            value: 4,
            source: "Dromedary Heritage",
            pack: PACK,
          },
          {
            target: "cha",
            type: "racial",
            value: -4,
            source: "Dromedary Heritage",
            pack: PACK,
          },
          {
            target: "con",
            type: "racial",
            value: 2,
            source: "Dromedary Heritage",
            pack: PACK,
          },
        ],
        traits: [
          {
            target: "cmb",
            type: "racial",
            value: 2,
            source: "Relentless",
            pack: PACK,
            condition:
              "bull rush or overrun while both creatures stand on the ground",
          },
        ],
        notes: [
          "Dromedary Heritage also grants Endurance and at-will ant haul, which are not automated yet.",
        ],
      },
      {
        id: "kemano-equine-heritage",
        name: "Equine Heritage",
        description:
          "Replace lagomorph heritage with equine traits: +2 Con, -2 Int, +2 Wis, and faster movement.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "dex",
            type: "racial",
            value: -2,
            source: "Equine Heritage",
            pack: PACK,
          },
          {
            target: "wis",
            type: "racial",
            value: 4,
            source: "Equine Heritage",
            pack: PACK,
          },
          {
            target: "cha",
            type: "racial",
            value: -2,
            source: "Equine Heritage",
            pack: PACK,
          },
          {
            target: "con",
            type: "racial",
            value: 2,
            source: "Equine Heritage",
            pack: PACK,
          },
          {
            target: "int",
            type: "racial",
            value: -2,
            source: "Equine Heritage",
            pack: PACK,
          },
        ],
        speed: 40,
        notes: [
          "Equine Heritage also grants Run and Alertness, which are not currently authored as race-selectable feats in the local catalog.",
        ],
      },
      {
        id: "kemano-feline-heritage",
        name: "Feline Heritage",
        description:
          "Replace lagomorph heritage with feline traits: nimble, clever, clawed, and darkvision-capable.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "cha",
            type: "racial",
            value: -2,
            source: "Feline Heritage",
            pack: PACK,
          },
          {
            target: "int",
            type: "racial",
            value: 2,
            source: "Feline Heritage",
            pack: PACK,
          },
        ],
        senses: { darkvisionFeet: 60 },
        grantedWeapons: [
          {
            name: "Claw",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["slashing"],
            specialTags: ["natural"],
          },
          {
            name: "Claw",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["slashing"],
            specialTags: ["natural"],
          },
        ],
        notes: [
          "Feline Heritage also grants Acrobatic; only the claw attacks and darkvision are automated here.",
        ],
      },
      {
        id: "kemano-primate-heritage",
        name: "Primate Heritage",
        description:
          "Replace lagomorph heritage with primate traits: charismatic climbers with a slam attack and swarming tactics.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "dex",
            type: "racial",
            value: -2,
            source: "Primate Heritage",
            pack: PACK,
          },
          {
            target: "wis",
            type: "racial",
            value: -2,
            source: "Primate Heritage",
            pack: PACK,
          },
        ],
        movementModes: { climb: 20 },
        traits: [
          {
            target: "skill.climb",
            type: "racial",
            value: 8,
            source: "Primate Climb",
            pack: PACK,
          },
        ],
        grantedWeapons: [
          {
            name: "Slam",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["bludgeoning"],
            specialTags: ["natural"],
          },
        ],
        notes: [
          "Primate Heritage also grants Swarming, which is not automated yet.",
        ],
      },
      {
        id: "kemano-ursine-heritage",
        name: "Ursine Heritage",
        description:
          "Replace lagomorph heritage with ursine traits: sturdy, clawed, and bite-capable.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "dex",
            type: "racial",
            value: -2,
            source: "Ursine Heritage",
            pack: PACK,
          },
          {
            target: "wis",
            type: "racial",
            value: 4,
            source: "Ursine Heritage",
            pack: PACK,
          },
          {
            target: "cha",
            type: "racial",
            value: -4,
            source: "Ursine Heritage",
            pack: PACK,
          },
          {
            target: "con",
            type: "racial",
            value: 2,
            source: "Ursine Heritage",
            pack: PACK,
          },
        ],
        grantedWeapons: [
          {
            name: "Bite",
            category: "melee",
            damageDice: "1d3",
            handedness: "light",
            damageTypes: ["piercing"],
            specialTags: ["natural"],
          },
          {
            name: "Claw",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["slashing"],
            specialTags: ["natural"],
          },
          {
            name: "Claw",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["slashing"],
            specialTags: ["natural"],
          },
        ],
        notes: [
          "Ursine Heritage also grants scent, which is not automated yet.",
        ],
      },
      {
        id: "kemano-bovine-heritage",
        name: "Bovine Heritage",
        description:
          "Replace lagomorph heritage with bovine traits: stronger, wiser, and built for a horned charge.",
        replaces: ["Lagomorph Heritage"],
        abilityModifiers: [
          {
            target: "dex",
            type: "racial",
            value: -2,
            source: "Bovine Heritage",
            pack: PACK,
          },
          {
            target: "str",
            type: "racial",
            value: 2,
            source: "Bovine Heritage",
            pack: PACK,
          },
          {
            target: "wis",
            type: "racial",
            value: 4,
            source: "Bovine Heritage",
            pack: PACK,
          },
          {
            target: "cha",
            type: "racial",
            value: -2,
            source: "Bovine Heritage",
            pack: PACK,
          },
        ],
        grantedWeapons: [
          {
            name: "Gore",
            category: "melee",
            damageDice: "1d6",
            handedness: "light",
            damageTypes: ["piercing"],
            specialTags: ["natural"],
          },
        ],
        notes: [
          "Bovine Heritage also grants Powerful Charge and Alertness; those are not automated yet.",
        ],
      },
      {
        id: "kemano-fury-born",
        name: "Fury Born",
        description:
          "Kemano natural attacks deal damage as if the creature were one size category larger.",
        replaces: ["Pass for Human"],
        notes: [
          "Fury Born modifies natural-attack damage sizing, which the current engine does not model yet.",
        ],
      },
      {
        id: "kemano-natures-hunter",
        name: "Nature’s Hunter",
        description:
          "Gain a +1 racial bonus on attack rolls against a chosen creature type or selected humanoid or outsider subtypes.",
        replaces: ["Pass for Human"],
        notes: [
          "Nature’s Hunter requires creature-type/subtype selection and conditional attack handling, which are not automated yet.",
        ],
      },
    ],
    notes: [
      "Kemano are modeled with Lagomorph Heritage as the default racial package so weapon-bearing heritages can be represented as alternates without needing unsupported weapon removal.",
      "Stubborn Mind's one-round-later retry and Pass for Human's take-10/disguise exception are only partially automated.",
      "Kemano type/subtype should vary by heritage, but the current race model does not track changing creature subtype tags.",
    ],
  },
  {
    id: "lobstross",
    name: "Lobstross",
    pack: PACK,
    size: "large",
    speed: 30,
    abilityModifiers: [
      {
        target: "str",
        type: "racial",
        value: 8,
        source: "Lobstross",
        pack: PACK,
      },
      {
        target: "dex",
        type: "racial",
        value: -2,
        source: "Lobstross",
        pack: PACK,
      },
      {
        target: "int",
        type: "racial",
        value: -2,
        source: "Lobstross",
        pack: PACK,
      },
      {
        target: "wis",
        type: "racial",
        value: -2,
        source: "Lobstross",
        pack: PACK,
      },
      {
        target: "cha",
        type: "racial",
        value: -2,
        source: "Lobstross",
        pack: PACK,
      },
    ],
    movementModes: { swim: 40 },
    alternateTraits: [
      {
        id: "lobstross-shallows-dweller",
        name: "Shallows Dweller",
        description:
          "Gain Darkvision 60 feet, but lose the +10-foot swim-speed increase from Powerful Swimmer.",
        replaces: ["Powerful Swimmer"],
        movementModes: { swim: 30 },
        senses: { darkvisionFeet: 60 },
      },
      {
        id: "lobstross-claw-king",
        name: "Claw King",
        description:
          "Replace grappling appendages with enormous claw limbs that deal 1d8 damage, have grab, and prevent normal weapon use.",
        replaces: ["Grabbing Appendages"],
        grantedWeapons: [
          {
            name: "Claw",
            category: "melee",
            damageDice: "1d8",
            handedness: "light",
            damageTypes: ["bludgeoning", "piercing"],
            specialTags: ["natural", "grab"],
          },
          {
            name: "Claw",
            category: "melee",
            damageDice: "1d8",
            handedness: "light",
            damageTypes: ["bludgeoning", "piercing"],
            specialTags: ["natural", "grab"],
          },
        ],
        notes: [
          "Claw King lobstross cannot wield normal weapons; that equipment restriction is not enforced yet.",
        ],
      },
    ],
    notes: [
      "Lobstross are Large monstrous humanoids; the current race model records size but not creature type tags.",
      "The source grants underwater-only Deepsight 120 feet, amphibious breathing, Frenzy 1/day, and Improved Grapple-style appendage rules; those are noted but not automated yet.",
      "Lobstross begin speaking only Lobstross. Bonus language selection is not modeled yet.",
    ],
  },
  {
    id: "savage-orc",
    name: "Savage Orc",
    pack: PACK,
    size: "medium",
    speed: 30,
    abilityModifiers: [
      {
        target: "str",
        type: "racial",
        value: 4,
        source: "Savage Orc",
        pack: PACK,
      },
      {
        target: "int",
        type: "racial",
        value: -2,
        source: "Savage Orc",
        pack: PACK,
      },
      {
        target: "wis",
        type: "racial",
        value: -2,
        source: "Savage Orc",
        pack: PACK,
      },
      {
        target: "cha",
        type: "racial",
        value: -2,
        source: "Savage Orc",
        pack: PACK,
      },
    ],
    senses: { darkvisionFeet: 60 },
    alternateTraits: [
      {
        id: "savage-orc-plains-runner",
        name: "Plains Runner",
        description:
          "Fleet-footed savage orcs trade Ferocity for the Run feat.",
        replaces: ["Ferocity"],
        notes: [
          "Plains Runner grants Run, but that feat is not currently authored in the local feat catalog.",
        ],
      },
    ],
    notes: [
      "Savage orcs are humanoids with the orc subtype; creature subtype tags are not separately modeled yet.",
      "Ferocity and orc weapon familiarity are noted but not automated by the current engine.",
      "Savage orcs begin speaking Common and Orc. Bonus language selection is not modeled yet.",
    ],
  },
  {
    id: "savage-bugbear",
    name: "Savage Bugbear",
    pack: PACK,
    size: "medium",
    speed: 30,
    abilityModifiers: [
      {
        target: "dex",
        type: "racial",
        value: 2,
        source: "Savage Bugbear",
        pack: PACK,
      },
      {
        target: "str",
        type: "racial",
        value: 2,
        source: "Savage Bugbear",
        pack: PACK,
      },
      {
        target: "cha",
        type: "racial",
        value: -2,
        source: "Savage Bugbear",
        pack: PACK,
      },
    ],
    traits: [
      {
        target: "skill.stealth",
        type: "racial",
        value: 4,
        source: "Sneaky",
        pack: PACK,
      },
    ],
    classSkills: ["stealth", "perception"],
    senses: { darkvisionFeet: 60 },
    alternateTraits: [
      {
        id: "savage-bugbear-true-goblinoid",
        name: "True Goblinoid",
        description: "Qualify as goblins for feats, race traits, and classes.",
        replaces: ["Skill Training"],
        notes: [
          "True Goblinoid changes qualification tags, which the current engine does not model yet.",
        ],
      },
      {
        id: "savage-bugbear-tinker",
        name: "Tinker",
        description:
          "Disable Device and Escape Artist are always class skills.",
        replaces: ["Skill Training"],
        classSkills: ["disable-device", "escape-artist"],
      },
      {
        id: "savage-bugbear-cardan",
        name: "Cardan",
        description:
          "Gain stronger stealth-in-motion tricks and a fixed human disguise form.",
        replaces: ["Scent"],
        traits: [
          {
            target: "skill.disguise",
            type: "racial",
            value: 10,
            source: "Cardan",
            pack: PACK,
            condition: "to appear as the bugbear's specific human form",
          },
        ],
        notes: [
          "Cardan's alter-self-style form change and special stealth movement rules are not fully automated yet.",
        ],
      },
      {
        id: "savage-bugbear-wikkawac",
        name: "Wikkawac",
        description:
          "Gain cold resistance 5 and stronger stealth in frozen terrain.",
        replaces: ["Scent"],
        resistances: { cold: 5 },
        traits: [
          {
            target: "skill.stealth",
            type: "racial",
            value: 4,
            source: "Wikkawac",
            pack: PACK,
            condition: "within frozen terrain",
          },
        ],
      },
      {
        id: "savage-bugbear-mudd",
        name: "Mudd",
        description: "Gain stronger swimming aptitude and +1 natural armor.",
        replaces: ["Scent"],
        traits: [
          {
            target: "skill.swim",
            type: "racial",
            value: 4,
            source: "Mudd",
            pack: PACK,
          },
          {
            target: "ac",
            type: "natural-armor",
            value: 1,
            source: "Mudd",
            pack: PACK,
          },
        ],
        notes: [
          "Mudd can always take 10 while swimming; that check-rule exception is not automated yet.",
        ],
      },
      {
        id: "savage-bugbear-slate-stalker",
        name: "Slate Stalker",
        description:
          "Gain fire resistance 5 and stronger stealth in urban terrain.",
        replaces: ["Scent"],
        resistances: { fire: 5 },
        traits: [
          {
            target: "skill.stealth",
            type: "racial",
            value: 4,
            source: "Slate Stalker",
            pack: PACK,
            condition: "within urban terrain",
          },
        ],
      },
      {
        id: "savage-bugbear-coalblack",
        name: "Coalblack",
        description:
          "Gain undead-like negative-energy affinity and blindsense 30 feet.",
        replaces: ["Scent"],
        notes: [
          "Coalblack grants Negative Energy Affinity and Blindsense 30 feet; neither is fully automated yet.",
        ],
      },
    ],
    notes: [
      "Savage bugbears are humanoids with the goblinoid subtype; subtype tags are not separately modeled yet.",
      "Savage bugbears begin speaking Common and Goblin. Bonus language selection is not modeled yet.",
      "Base scent is noted but not automated by the current engine.",
    ],
  },
  {
    id: "savage-hobgoblin",
    name: "Savage Hobgoblin",
    pack: PACK,
    size: "medium",
    speed: 30,
    abilityModifiers: [
      {
        target: "dex",
        type: "racial",
        value: 2,
        source: "Savage Hobgoblin",
        pack: PACK,
      },
      {
        target: "con",
        type: "racial",
        value: 2,
        source: "Savage Hobgoblin",
        pack: PACK,
      },
    ],
    traits: [
      {
        target: "skill.stealth",
        type: "racial",
        value: 4,
        source: "Sneaky",
        pack: PACK,
      },
      {
        target: "init",
        type: "untyped",
        value: 4,
        source: "Quick Reactions",
        pack: PACK,
      },
    ],
    senses: { darkvisionFeet: 60 },
    alternateTraits: [
      {
        id: "savage-hobgoblin-commanding",
        name: "Commanding",
        description: "Gain a +4 racial bonus to Leadership instead of Sneaky.",
        replaces: ["Sneaky"],
        notes: [
          "Leadership score adjustments are not modeled by the current engine.",
        ],
      },
    ],
    notes: [
      "Savage hobgoblins are humanoids with the goblinoid subtype; subtype tags are not separately modeled yet.",
      "Savage hobgoblins begin speaking Common and Goblin. Bonus language selection is not modeled yet.",
    ],
  },
  {
    id: "savage-kobold",
    name: "Savage Kobold",
    pack: PACK,
    size: "small",
    speed: 30,
    abilityModifiers: [
      {
        target: "dex",
        type: "racial",
        value: 2,
        source: "Savage Kobold",
        pack: PACK,
      },
      {
        target: "str",
        type: "racial",
        value: -2,
        source: "Savage Kobold",
        pack: PACK,
      },
      {
        target: "int",
        type: "racial",
        value: 2,
        source: "Savage Kobold",
        pack: PACK,
      },
    ],
    traits: [
      {
        target: "ac",
        type: "natural-armor",
        value: 1,
        source: "Natural Armor",
        pack: PACK,
      },
      {
        target: "skill.perception",
        type: "racial",
        value: 2,
        source: "Crafty",
        pack: PACK,
      },
    ],
    classSkills: ["craft.trapmaking", "stealth"],
    senses: { darkvisionFeet: 60 },
    alternateTraits: [
      {
        id: "savage-kobold-tough-hide",
        name: "Tough Hide",
        description:
          "Gain an additional +2 natural armor bonus, replacing Crafty.",
        replaces: ["Crafty"],
        traits: [
          {
            target: "ac",
            type: "natural-armor",
            value: 2,
            source: "Tough Hide",
            pack: PACK,
          },
        ],
        notes: [
          "Crafty also grants bonuses to Craft (trapmaking) and Profession (miner); skill-specific support for those subskills is not fully modeled here.",
        ],
      },
    ],
    notes: [
      "Savage kobolds are humanoids with the reptilian subtype; subtype tags are not separately modeled yet.",
      "Savage kobolds begin speaking Draconic. Bonus language selection is not modeled yet.",
      "Crafty also grants bonuses to Craft (trapmaking) and Profession (miner), but those subskill keys are not fully supported in the current authored skill set.",
    ],
  },
  {
    id: "skeletal",
    name: "Skeletal",
    pack: PACK,
    size: "medium",
    speed: 30,
    abilityModifiers: [],
    traits: [
      {
        target: "save.fort",
        type: "racial",
        value: 2,
        source: "Undead Resistance",
        pack: PACK,
        condition: "vs disease",
      },
      {
        target: "save.will",
        type: "racial",
        value: 2,
        source: "Undead Resistance",
        pack: PACK,
        condition: "vs mind-affecting effects",
      },
      {
        target: "skill.disguise",
        type: "racial",
        value: 20,
        source: "Feign Death",
        pack: PACK,
        condition:
          "to appear as a normal deceased creature while prone and limp",
      },
    ],
    senses: { darkvisionFeet: 60 },
    alternateTraits: [
      {
        id: "skeletal-lifebound-soul",
        name: "Lifebound Soul",
        description:
          "Positive and negative energy affect you normally, replacing resist level drain.",
        replaces: ["Resist Level Drain"],
        notes: [
          "Lifebound Soul flips the race's negative-energy affinity behavior, which the current engine does not model yet.",
        ],
      },
    ],
    notes: [
      "Skeletals inherit the ability score modifiers of the donor corpse race; that donor-race selection is not modeled yet, so this import leaves base abilityModifiers empty and documents the inheritance rule.",
      "Skeletals count as both Skeletal and their donor corpse race for qualifying for feats, traits, and favored class bonuses; cross-race qualification tags are not modeled yet.",
      "Negative Energy Affinity, Resist Level Drain, Unliving, Calcium Fiend, and the action economy of Feign Death are documented but not automated by the current engine.",
      "Skeletals begin speaking Common. Bonus language selection tied to donor corpse race is not modeled yet.",
    ],
  },
];
