import type { RaceDefinition } from "../../types";

export const CORE_RACES: RaceDefinition[] = [
  {
    id: "dwarf",
    name: "Dwarf",
    pack: "core",
    size: "medium",
    speed: 20,
    abilityModifiers: [
      {
        target: "con",
        type: "racial",
        value: 2,
        source: "Dwarf",
        pack: "core",
      },
      {
        target: "wis",
        type: "racial",
        value: 2,
        source: "Dwarf",
        pack: "core",
      },
      {
        target: "cha",
        type: "racial",
        value: -2,
        source: "Dwarf",
        pack: "core",
      },
    ],
    alternateTraits: [
      {
        id: "stonesinger",
        name: "Stonesinger",
        description:
          "+1 bonus on Perform (sing) and Knowledge (dungeoneering) checks.",
        replaces: ["Greed"],
        traits: [
          {
            target: "skill.perform",
            type: "racial",
            value: 1,
            source: "Stonesinger",
            pack: "core",
          },
          {
            target: "skill.knowledge.dungeoneering",
            type: "racial",
            value: 1,
            source: "Stonesinger",
            pack: "core",
          },
        ],
      },
      {
        id: "surface-survivor",
        name: "Surface Survivor",
        description:
          "Trades some underground resilience for surface-adapted hardiness.",
        replaces: ["Stonecunning"],
        notes: [
          "Surface Survivor has conditional poison/disease benefits that are not automated yet.",
        ],
      },
    ],
  },
  {
    id: "elf",
    name: "Elf",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [
      { target: "dex", type: "racial", value: 2, source: "Elf", pack: "core" },
      { target: "int", type: "racial", value: 2, source: "Elf", pack: "core" },
      { target: "con", type: "racial", value: -2, source: "Elf", pack: "core" },
    ],
    alternateTraits: [
      {
        id: "fleet-footed",
        name: "Fleet-Footed",
        description: "Base land speed increases to 40 feet.",
        replaces: ["Weapon Familiarity"],
        speed: 40,
      },
      {
        id: "urbanite",
        name: "Urbanite",
        description: "Keen urban instincts replace some woodland training.",
        replaces: ["Keen Senses"],
        traits: [
          {
            target: "skill.sense-motive",
            type: "racial",
            value: 2,
            source: "Urbanite",
            pack: "core",
          },
          {
            target: "skill.diplomacy",
            type: "racial",
            value: 2,
            source: "Urbanite",
            pack: "core",
          },
        ],
      },
    ],
  },
  {
    id: "gnome",
    name: "Gnome",
    pack: "core",
    size: "small",
    speed: 20,
    abilityModifiers: [
      {
        target: "con",
        type: "racial",
        value: 2,
        source: "Gnome",
        pack: "core",
      },
      {
        target: "cha",
        type: "racial",
        value: 2,
        source: "Gnome",
        pack: "core",
      },
      {
        target: "str",
        type: "racial",
        value: -2,
        source: "Gnome",
        pack: "core",
      },
    ],
    alternateTraits: [
      {
        id: "academician",
        name: "Academician",
        description:
          "+2 bonus on one Knowledge skill and that skill is always a class skill.",
        replaces: ["Obsessive"],
        traits: [
          {
            target: "skill.knowledge.arcana",
            type: "racial",
            value: 2,
            source: "Academician",
            pack: "core",
          },
        ],
        classSkills: ["knowledge.arcana"],
        notes: [
          "Academician is currently seeded as Knowledge (arcana); per-build knowledge-skill choice is not modeled yet.",
        ],
      },
      {
        id: "gift-of-tongues",
        name: "Gift of Tongues",
        description: "Social talent replaces some illusion-focused training.",
        replaces: ["Gnome Magic"],
        traits: [
          {
            target: "skill.bluff",
            type: "racial",
            value: 1,
            source: "Gift of Tongues",
            pack: "core",
          },
          {
            target: "skill.diplomacy",
            type: "racial",
            value: 1,
            source: "Gift of Tongues",
            pack: "core",
          },
        ],
      },
    ],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [],
    choiceOptions: {
      flexibleAbilityBonus: { value: 2 },
    },
    alternateTraits: [
      {
        id: "dual-minded",
        name: "Dual-Minded",
        description: "+2 bonus on Will saving throws.",
        replaces: ["Adaptability"],
        traits: [
          {
            target: "save.will",
            type: "racial",
            value: 2,
            source: "Dual-Minded",
            pack: "core",
          },
        ],
      },
      {
        id: "integrated",
        name: "Integrated",
        description:
          "Community-trained aptitude replaces broad half-elven adaptability.",
        replaces: ["Multitalented"],
        traits: [
          {
            target: "skill.diplomacy",
            type: "racial",
            value: 1,
            source: "Integrated",
            pack: "core",
          },
          {
            target: "skill.knowledge.local",
            type: "racial",
            value: 1,
            source: "Integrated",
            pack: "core",
          },
        ],
      },
    ],
    notes: ["Multitalented and Skill Focus are not automated yet."],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [],
    choiceOptions: {
      flexibleAbilityBonus: { value: 2 },
    },
    alternateTraits: [
      {
        id: "sacred-tattoo",
        name: "Sacred Tattoo",
        description: "+1 luck bonus on all saving throws.",
        replaces: ["Orc Ferocity"],
        traits: [
          {
            target: "save.all",
            type: "luck",
            value: 1,
            source: "Sacred Tattoo",
            pack: "core",
          },
        ],
      },
      {
        id: "toothy",
        name: "Toothy",
        description: "Gain a bite natural attack.",
        replaces: ["Intimidating"],
        grantedWeapons: [
          {
            name: "Bite",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["piercing"],
            specialTags: ["natural"],
          },
        ],
      },
    ],
    notes: [
      "Orc Ferocity, Intimidating, and weapon familiarity are not automated yet.",
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    pack: "core",
    size: "small",
    speed: 20,
    abilityModifiers: [
      {
        target: "dex",
        type: "racial",
        value: 2,
        source: "Halfling",
        pack: "core",
      },
      {
        target: "cha",
        type: "racial",
        value: 2,
        source: "Halfling",
        pack: "core",
      },
      {
        target: "str",
        type: "racial",
        value: -2,
        source: "Halfling",
        pack: "core",
      },
    ],
    alternateTraits: [
      {
        id: "fleet-of-foot",
        name: "Fleet of Foot",
        description: "Base land speed increases to 30 feet.",
        replaces: ["Slow Speed"],
        speed: 30,
      },
      {
        id: "adaptable-luck",
        name: "Adaptable Luck",
        description: "Trades static luck for swingier reroll-style fortune.",
        replaces: ["Halfling Luck"],
        notes: [
          "Adaptable Luck is not automated yet because it is an activated/reroll mechanic rather than a passive modifier.",
        ],
      },
    ],
  },
  {
    id: "human",
    name: "Human",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [],
    choiceOptions: {
      flexibleAbilityBonus: { value: 2 },
      bonusFeat: { count: 1 },
      extraSkillRanksPerLevel: 1,
    },
    alternateTraits: [
      {
        id: "focused-study",
        name: "Focused Study",
        description:
          "Trades the human bonus feat for later Skill Focus progression.",
        replaces: ["Bonus Feat"],
        removeChoiceOptions: ["bonusFeat"],
        notes: [
          "Focused Study normally grants Skill Focus at levels 1, 8, and 16; that progression is not automated yet.",
        ],
      },
      {
        id: "heart-of-the-fields",
        name: "Heart of the Fields",
        description:
          "Trades the extra skill rank per level for broader once-per-day competence with one Profession or Craft.",
        replaces: ["Skilled"],
        removeChoiceOptions: ["extraSkillRanksPerLevel"],
        notes: ["Heart of the Fields is not fully automated yet."],
      },
    ],
  },
];
