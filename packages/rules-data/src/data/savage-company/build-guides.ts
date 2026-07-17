import type { BuildGuideDefinition } from "../../types";

export const SAVAGE_COMPANY_BUILD_GUIDES: BuildGuideDefinition[] = [
  {
    id: "infantryman-firearm-drill",
    name: "Infantryman Firearm Drill",
    pack: "savage-company",
    description:
      "A disciplined Infantryman firearm build that values Dexterity, Constitution, and ranged pressure over melee cosplay.",
    classNames: ["Infantryman"],
    favoredClassName: "Infantryman",
    statPriorities: ["dex", "con", "wis"],
    featPriorities: [
      "Deadly Aim",
      "Improved Initiative",
      "Toughness",
      "Lightning Reflexes",
      "Weapon Focus",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: [
      "perception",
      "survival",
      "knowledge.engineering",
      "sleight-of-hand",
    ],
    progression: [
      {
        maxLevel: 4,
        statPriorities: ["dex", "con"],
        featPriorities: ["Improved Initiative", "Toughness"],
        notes: ["Stay alive and accurate until Gun Training comes online."],
      },
      {
        minLevel: 5,
        featPriorities: ["Deadly Aim", "Weapon Focus"],
        notes: ["Once Gun Training lands, lean harder into ranged scaling."],
      },
    ],
    branches: [
      {
        id: "infantryman-dex-pivot",
        when: { abilityAtLeast: { dex: 17 }, minLevel: 5 },
        statPriorities: ["dex", "con"],
        featPriorities: ["Deadly Aim", "Improved Initiative"],
        notes: [
          "High Dexterity confirms the real gun lane, so stop hedging into fake melee ambitions.",
        ],
      },
    ],
    notes: [
      "Dexterity is doing the heavy lifting once the gun plan comes online.",
      "If you want to be a gun build, stop pretending Strength is the main event.",
    ],
  },
  {
    id: "operator-commando",
    name: "Operator Commando",
    pack: "savage-company",
    description:
      "A mobile firearm-and-close-quarters brawler guide that wants Dexterity, initiative, and flexible weapon pressure.",
    classNames: ["Brawler"],
    archetypeIds: ["operator"],
    statPriorities: ["dex", "con", "wis"],
    featPriorities: [
      "Deadly Aim",
      "Improved Initiative",
      "Combat Reflexes",
      "Toughness",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: ["acrobatics", "perception", "intimidate", "stealth"],
    progression: [
      {
        maxLevel: 4,
        featPriorities: ["Improved Initiative", "Combat Reflexes"],
        notes: ["Operator wants to act first and keep action pressure high."],
      },
      {
        minLevel: 5,
        featPriorities: ["Deadly Aim", "Toughness"],
        notes: [
          "Gun Training and firearm pressure start being worth real investment here.",
        ],
      },
    ],
    notes: [
      "This lane likes movement, aggression, and enough durability to survive your own enthusiasm.",
    ],
  },
  {
    id: "covert-infiltrator-operator",
    name: "Covert Infiltrator Operator",
    pack: "savage-company",
    description:
      "A stealth-and-knowledge guide for covert builds that prize Dexterity, Intelligence, and useful utility feat chains.",
    classNames: ["Rogue"],
    archetypeIds: ["covert-infiltrator"],
    statPriorities: ["dex", "int", "wis"],
    featPriorities: [
      "Weapon Finesse",
      "Improved Initiative",
      "Combat Expertise",
      "Dodge",
      "Iron Will",
    ],
    favoredClassBonusPriority: ["skill", "hp"],
    skillPriorities: [
      "stealth",
      "disable-device",
      "perception",
      "bluff",
      "linguistics",
      "knowledge.local",
    ],
    progression: [
      {
        maxLevel: 4,
        featPriorities: ["Weapon Finesse", "Improved Initiative"],
        skillPriorities: ["stealth", "disable-device", "perception", "bluff"],
        notes: ["Get the spy toolkit running immediately."],
      },
      {
        minLevel: 5,
        featPriorities: ["Combat Expertise", "Iron Will"],
        notes: [
          "After Signature Weapon, start patching utility and survivability.",
        ],
      },
    ],
    notes: [
      "Extra skills and information play are the point, so lean into them.",
      "This lane wants speed, utility, and actually passing trained checks.",
    ],
  },
  {
    id: "craftwright-maker",
    name: "Craftwright Maker",
    pack: "savage-company",
    description:
      "A crafting-focused guide that pushes Intelligence, utility, and the authored crafting feat chain instead of random combat filler.",
    archetypeIds: ["craftwright"],
    statPriorities: ["int", "con", "dex"],
    featPriorities: [
      "Master Craftsman",
      "Craft Construct",
      "Toughness",
      "Iron Will",
    ],
    favoredClassBonusPriority: ["skill", "hp"],
    skillPriorities: [
      "craft",
      "knowledge.engineering",
      "spellcraft",
      "perception",
    ],
    progression: [
      {
        maxLevel: 4,
        featPriorities: ["Master Craftsman", "Toughness"],
        skillPriorities: ["craft", "knowledge.engineering", "spellcraft"],
        notes: ["Feed the crafting chassis before luxury combat picks."],
      },
      {
        minLevel: 5,
        featPriorities: ["Craft Construct", "Iron Will"],
        notes: [
          "Once the construct lane opens, stop wasting levels dithering.",
        ],
      },
    ],
    notes: [
      "If you picked Craftwright, maybe actually craft things. Wild suggestion, I know.",
      "Skill pressure and feat chains matter more here than generic martial filler.",
    ],
  },
  {
    id: "battle-chaplain-vanguard",
    name: "Battle Chaplain Vanguard",
    pack: "savage-company",
    description:
      "A front-line support cleric guide built around Wisdom, staying power, and martial support spell choices.",
    classNames: ["Cleric"],
    archetypeIds: ["battle-chaplain"],
    statPriorities: ["wis", "con", "str"],
    featPriorities: [
      "Toughness",
      "Improved Initiative",
      "Weapon Focus",
      "Iron Will",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: [
      "heal",
      "spellcraft",
      "knowledge.religion",
      "sense-motive",
    ],
    spellPriorities: [
      "Bless",
      "Shield of Faith",
      "Divine Favor",
      "Aid",
      "Bull's Strength",
      "Cure Moderate Wounds",
    ],
    progression: [
      {
        maxLevel: 4,
        spellPriorities: ["Bless", "Shield of Faith", "Divine Favor"],
        notes: [
          "Early Battle Chaplain work is keeping the line alive and angry.",
        ],
      },
      {
        minLevel: 5,
        featPriorities: ["Weapon Focus", "Toughness"],
        notes: [
          "Weapon Training means martial accuracy starts paying off harder.",
        ],
      },
    ],
    branches: [
      {
        id: "battle-chaplain-iron-wall",
        when: { abilityAtLeast: { con: 14 }, minLevel: 5 },
        favoredClassBonusPriority: ["hp"],
        statPriorities: ["wis", "con"],
        notes: [
          "If the body is sturdy enough, double down on front-line support staying power.",
        ],
      },
    ],
    notes: [
      "Domains are gone here, so build around martial support instead of pretending they still exist.",
    ],
  },
  {
    id: "roughneck-ranger-sapper",
    name: "Roughneck Ranger Sapper",
    pack: "savage-company",
    description:
      "A trap-and-alchemy guerrilla guide that emphasizes utility skills, Dexterity, and practical field survivability.",
    classNames: ["Ranger"],
    archetypeIds: ["roughneck-ranger"],
    statPriorities: ["dex", "wis", "con"],
    featPriorities: [
      "Improved Initiative",
      "Deadly Aim",
      "Toughness",
      "Lightning Reflexes",
    ],
    favoredClassBonusPriority: ["skill", "hp"],
    skillPriorities: [
      "craft",
      "disable-device",
      "perception",
      "survival",
      "knowledge.engineering",
    ],
    spellPriorities: [
      "Gravity Bow",
      "Aspect of the Falcon",
      "Delay Poison",
      "Barkskin",
    ],
    progression: [
      {
        maxLevel: 4,
        skillPriorities: ["craft", "disable-device", "perception", "survival"],
        featPriorities: ["Improved Initiative", "Toughness"],
        notes: ["The trap/alchemy package starts with skills, not ego."],
      },
      {
        minLevel: 5,
        featPriorities: ["Deadly Aim", "Lightning Reflexes"],
        notes: [
          "Once the trap economy exists, ranged consistency gets more valuable.",
        ],
      },
    ],
    branches: [
      {
        id: "roughneck-ranged-commit",
        when: { abilityAtLeast: { dex: 16 }, featNamesAny: ["Deadly Aim"] },
        featPriorities: ["Lightning Reflexes", "Improved Initiative"],
        spellPriorities: ["Gravity Bow", "Aspect of the Falcon"],
        notes: [
          "Once the ranged package is real, lean into accuracy and field survivability.",
        ],
      },
    ],
    notes: [
      "You traded spells for traps; act like it and invest in the actual toolbox.",
    ],
  },
  {
    id: "zen-gunman-discipline",
    name: "Zen Gunman Discipline",
    pack: "savage-company",
    description:
      "A firearm monk guide that leans on Wisdom, Dexterity, initiative, and precise ranged support rather than brute force.",
    classNames: ["Monk"],
    archetypeIds: ["zen-gunman"],
    statPriorities: ["wis", "dex", "con"],
    featPriorities: [
      "Improved Initiative",
      "Weapon Focus",
      "Lightning Reflexes",
      "Deadly Aim",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: ["acrobatics", "perception", "stealth"],
    progression: [
      {
        maxLevel: 4,
        statPriorities: ["wis", "dex"],
        featPriorities: ["Improved Initiative", "Weapon Focus"],
        notes: ["Before the deeper gun tricks, just be accurate and alive."],
      },
      {
        minLevel: 5,
        featPriorities: ["Deadly Aim", "Lightning Reflexes"],
        notes: ["Ki bullets and firearm flurry reward ranged commitment now."],
      },
    ],
    notes: [
      "Wisdom matters here a lot more than the average gun build, so don’t dump it like a clown.",
    ],
  },
  {
    id: "steel-saint-gun-paladin",
    name: "Steel Saint Gun Paladin",
    pack: "savage-company",
    description:
      "A righteous firearm paladin guide balancing Charisma, survivability, and ranged divine pressure.",
    classNames: ["Paladin"],
    archetypeIds: ["steel-saint"],
    statPriorities: ["cha", "dex", "con"],
    featPriorities: [
      "Improved Initiative",
      "Toughness",
      "Weapon Focus",
      "Iron Will",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: [
      "perception",
      "sense-motive",
      "knowledge.nobility",
      "heal",
    ],
    spellPriorities: [
      "Bless Weapon",
      "Protection from Evil",
      "Shield of Faith",
      "Divine Favor",
      "Aid",
    ],
    progression: [
      {
        maxLevel: 4,
        spellPriorities: [
          "Bless Weapon",
          "Protection from Evil",
          "Shield of Faith",
        ],
        notes: [
          "Early Steel Saint is mostly survival plus righteous gun setup.",
        ],
      },
      {
        minLevel: 5,
        featPriorities: ["Weapon Focus", "Toughness"],
        notes: [
          "Once Divine Bond lands, make the bonded firearm actually matter.",
        ],
      },
    ],
    notes: [
      "You are a gun paladin, not a confused sword tourist with powder stains.",
    ],
  },
  {
    id: "phantom-warrior-martial-bond",
    name: "Phantom Warrior Martial Bond",
    pack: "savage-company",
    description:
      "A martial spiritualist guide centered on front-line pressure, resilience, and the resolute phantom partnership.",
    classNames: ["Spiritualist"],
    archetypeIds: ["phantom-warrior"],
    statPriorities: ["str", "con", "wis"],
    featPriorities: [
      "Power Attack",
      "Toughness",
      "Improved Initiative",
      "Iron Will",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: [
      "perception",
      "intimidate",
      "knowledge.religion",
      "survival",
    ],
    progression: [
      {
        maxLevel: 4,
        featPriorities: ["Toughness", "Improved Initiative"],
        notes: ["Before Weapon Training, stay upright and useful."],
      },
      {
        minLevel: 5,
        featPriorities: ["Power Attack", "Iron Will"],
        notes: [
          "Once martial scaling turns on, commit harder to the front line.",
        ],
      },
    ],
    notes: [
      "You traded spellcasting away, so make the martial partnership count.",
    ],
  },
  {
    id: "retribution-siege-priest",
    name: "Retribution Siege Priest",
    pack: "savage-company",
    description:
      "A warpriest artillery guide focused on siege support, wisdom-based utility, and crew-enabling play.",
    classNames: ["Warpriest"],
    archetypeIds: ["retribution"],
    statPriorities: ["wis", "con", "str"],
    featPriorities: [
      "Siege Engineer",
      "Master Siege Engineer",
      "Toughness",
      "Improved Initiative",
    ],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: [
      "knowledge.engineering",
      "perception",
      "spellcraft",
      "intimidate",
    ],
    progression: [
      {
        maxLevel: 3,
        featPriorities: ["Siege Engineer", "Toughness"],
        notes: [
          "Get into the artillery lane immediately instead of later apologizing.",
        ],
      },
      {
        minLevel: 9,
        featPriorities: ["Master Siege Engineer"],
        notes: [
          "At this point the build should stop pretending it isn't siege-focused.",
        ],
      },
    ],
    notes: [
      "This lane exists to make siege warfare less embarrassing for your side.",
    ],
  },
];
