import type { BuildGuideDefinition } from "../../types";

export const CORE_BUILD_GUIDES: BuildGuideDefinition[] = [
  {
    id: "fighter-frontliner",
    name: "Fighter Frontliner",
    pack: "core",
    description:
      "A straightforward martial bruiser that wants Strength, Constitution, and reliable melee feat progression.",
    classNames: ["Fighter"],
    favoredClassName: "Fighter",
    statPriorities: ["str", "con", "dex"],
    featPriorities: [
      "Power Attack",
      "Weapon Focus",
      "Cleave",
      "Toughness",
      "Improved Initiative",
    ],
    favoredClassBonusPriority: ["hp"],
    skillPriorities: ["intimidate", "perception", "climb", "survival"],
    progression: [
      {
        maxLevel: 2,
        featPriorities: ["Power Attack", "Toughness"],
        notes: ["Get the basic melee package online early."],
      },
      {
        minLevel: 3,
        maxLevel: 6,
        featPriorities: ["Weapon Focus", "Cleave", "Improved Initiative"],
        notes: ["Start cleaning up accuracy and action tempo."],
      },
      {
        minLevel: 7,
        statPriorities: ["str", "con"],
        notes: ["By mid levels, keep scaling offense before vanity picks."],
      },
    ],
    branches: [
      {
        id: "fighter-durable-low-con",
        when: { abilityAtLeast: { str: 15 }, maxLevel: 8 },
        featPriorities: ["Toughness", "Great Fortitude"],
        favoredClassBonusPriority: ["hp"],
        notes: [
          "If Strength is online early, survival padding gets more urgent than greed.",
        ],
      },
    ],
    notes: [
      "Stay in Fighter unless you have a deliberate multiclass reason.",
      "Melee accuracy and survivability matter more than cute tricks.",
    ],
  },
  {
    id: "wizard-controller",
    name: "Wizard Controller",
    pack: "core",
    description:
      "A prepared caster guide that prioritizes Intelligence, spellcasting progression, and defensive glue feats.",
    classNames: ["Wizard"],
    favoredClassName: "Wizard",
    statPriorities: ["int", "dex", "con"],
    featPriorities: [
      "Improved Initiative",
      "Toughness",
      "Iron Will",
      "Combat Expertise",
    ],
    favoredClassBonusPriority: ["skill", "hp"],
    skillPriorities: [
      "spellcraft",
      "knowledge.arcana",
      "knowledge.planes",
      "knowledge.history",
    ],
    spellPriorities: [
      "Detect Magic",
      "Mage Hand",
      "Mage Armor",
      "Shield",
      "Grease",
      "Color Spray",
      "Invisibility",
      "Resist Energy",
    ],
    progression: [
      {
        maxLevel: 1,
        spellPriorities: [
          "Detect Magic",
          "Read Magic",
          "Mage Hand",
          "Mage Armor",
          "Shield",
          "Grease",
          "Color Spray",
        ],
        notes: ["Early control and self-protection beat flashy nonsense."],
      },
      {
        minLevel: 2,
        maxLevel: 4,
        spellPriorities: [
          "Invisibility",
          "Blur",
          "Scorching Ray",
          "Resist Energy",
        ],
        statPriorities: ["int", "dex"],
        notes: ["Mid-low levels want safety plus flexible encounter control."],
      },
      {
        minLevel: 5,
        featPriorities: ["Improved Initiative", "Iron Will"],
        notes: ["Patch initiative and bad saves before greed takes over."],
      },
    ],
    branches: [
      {
        id: "wizard-brainiac-pivot",
        when: { abilityAtLeast: { int: 18 }, minLevel: 4 },
        statPriorities: ["int", "con"],
        spellPriorities: ["Invisibility", "Resist Energy", "Blur"],
        notes: [
          "If Intelligence is already absurd, keep feeding the casting engine and just enough durability.",
        ],
      },
    ],
    notes: [
      "Protect Intelligence first; dead wizards cast very few spells.",
      "Dexterity and Constitution keep you alive long enough to be smug.",
    ],
  },
  {
    id: "rogue-skill-monkey",
    name: "Rogue Skill Monkey",
    pack: "core",
    description:
      "An agile utility build that leans on Dexterity, Intelligence, and initiative-friendly feat picks.",
    classNames: ["Rogue"],
    favoredClassName: "Rogue",
    statPriorities: ["dex", "int", "con"],
    featPriorities: [
      "Weapon Finesse",
      "Improved Initiative",
      "Dodge",
      "Combat Reflexes",
      "Toughness",
    ],
    favoredClassBonusPriority: ["skill", "hp"],
    skillPriorities: [
      "stealth",
      "disable-device",
      "perception",
      "acrobatics",
      "bluff",
      "sleight-of-hand",
      "use-magic-device",
    ],
    progression: [
      {
        maxLevel: 2,
        featPriorities: ["Weapon Finesse", "Improved Initiative"],
        notes: ["Get your agility package online immediately."],
      },
      {
        minLevel: 3,
        skillPriorities: [
          "stealth",
          "disable-device",
          "perception",
          "use-magic-device",
        ],
        notes: ["Core rogue utility skills should stay fed every level."],
      },
    ],
    notes: [
      "Dexterity does a ton of work here, so don’t neglect it chasing memes.",
      "Skill ranks are a feature, not decorative garnish.",
    ],
  },
  {
    id: "cleric-battle-support",
    name: "Cleric Battle Support",
    pack: "core",
    description:
      "A practical cleric build focused on Wisdom, battlefield support, and durable buffs instead of pretending to be a wizard.",
    classNames: ["Cleric"],
    favoredClassName: "Cleric",
    statPriorities: ["wis", "con", "str"],
    featPriorities: ["Toughness", "Improved Initiative", "Iron Will"],
    favoredClassBonusPriority: ["hp", "skill"],
    skillPriorities: [
      "heal",
      "spellcraft",
      "knowledge.religion",
      "sense-motive",
    ],
    spellPriorities: [
      "Guidance",
      "Bless",
      "Cure Light Wounds",
      "Shield of Faith",
      "Divine Favor",
      "Aid",
      "Bull's Strength",
      "Cure Moderate Wounds",
    ],
    progression: [
      {
        maxLevel: 2,
        spellPriorities: [
          "Bless",
          "Shield of Faith",
          "Divine Favor",
          "Cure Light Wounds",
        ],
        notes: [
          "Low-level clerics carry fights with buffs and stabilization, not drama.",
        ],
      },
      {
        minLevel: 3,
        spellPriorities: ["Aid", "Bull's Strength", "Cure Moderate Wounds"],
        statPriorities: ["wis", "con"],
        notes: ["Keep the support engine online first."],
      },
    ],
    notes: [
      "Wisdom matters more than vanity melee stats unless the build has a specific combat angle.",
    ],
  },
];
