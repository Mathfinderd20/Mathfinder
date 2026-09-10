import {
  buildCharacter,
  computeSheet,
  equipmentMagicItemTemplate,
  equipmentWeaponTemplate,
  type CharacterBuild,
  type EquipmentEntry,
  type SkillKey,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_ARCHETYPES,
  RUNTIME_SPELLS,
  RUNTIME_RACE_OPTIONS,
  RUNTIME_WEAPONS,
  RUNTIME_MAGIC_ITEMS,
  RUNTIME_ARMOR,
  RUNTIME_CLASS_OPTIONS,
} from "../../content";
import { skillPointBudgetForLevel } from "../../skillRankProgression";
import type { CharacterDetails } from "./characterRepository";

function race(name: string): CharacterBuild["race"] {
  const matches = RUNTIME_RACE_OPTIONS.map(([, value]) => value).filter(
    (value) => value.name === name,
  );
  if (!matches.length) throw new Error(`Missing review ancestry: ${name}`);
  const core =
    matches.find((value) => value.id === name.toLowerCase()) ?? matches[0]!;
  const detailed = matches.find((value) => value.notes?.length) ?? core;
  return {
    ...core,
    notes: detailed.notes,
    senses: detailed.senses ?? core.senses,
    choiceSelection: {
      flexibleAbility: core.choiceOptions?.flexibleAbilityBonus
        ? "str"
        : undefined,
      alternateTraits: [],
    },
  };
}
function weapon(name: string): EquipmentEntry {
  const item = RUNTIME_WEAPONS.find(
    (value) => value.name.toLowerCase() === name.toLowerCase(),
  );
  if (!item) throw new Error(`Missing review weapon: ${name}`);
  return {
    ...equipmentWeaponTemplate(item),
    kind: "mundane",
    ownership: "owned",
    equipped: true,
    carryState: "carried",
    quantity: 1,
  };
}
function magic(name: string): EquipmentEntry {
  const item = RUNTIME_MAGIC_ITEMS.find((value) => value.name === name);
  if (!item && name === "Belt of Incredible Dexterity +2")
    return {
      name,
      kind: "magic",
      ownership: "owned",
      equipped: true,
      carryState: "carried",
      slot: "belt",
      quantity: 1,
      weight: 1,
      costGp: 4000,
      modifiers: [
        { source: name, target: "dex", type: "enhancement", value: 2 },
      ],
    };
  if (!item) throw new Error(`Missing review item: ${name}`);
  return {
    ...equipmentMagicItemTemplate(item),
    kind: "magic",
    ownership: "owned",
    equipped: true,
    carryState: "carried",
    quantity: 1,
  };
}
function armor(name: string): EquipmentEntry {
  const item = RUNTIME_ARMOR.find(
    (value) => value.name.toLowerCase() === name.toLowerCase(),
  );
  if (!item || !item.categoryNormalized || item.categoryNormalized === "shield")
    throw new Error(`Missing review armor: ${name}`);
  return {
    name: item.name,
    itemTemplateId: item.id,
    kind: "mundane",
    quantity: 1,
    costGp: item.costGp,
    weight: item.weightLb,
    equipped: true,
    carryState: "carried",
    slot: "armor",
    modifiers: item.modifiers,
    armor: {
      category: item.categoryNormalized,
      acBonus: item.armorBonus,
      maxDexBonus: item.maxDexBonus,
      checkPenalty: Math.abs(item.armorCheckPenalty ?? 0),
      speed30: item.speed30,
      speed20: item.speed20,
    },
  };
}
function gear(): EquipmentEntry[] {
  return [
    {
      name: "Backpack",
      weight: 2,
      costGp: 2,
      quantity: 1,
      carryState: "carried",
      containerCapacityLb: 30,
    },
    {
      name: "Trail rations",
      weight: 1,
      costGp: 0.5,
      quantity: 3,
      carryState: "carried",
      containerName: "Backpack",
    },
    {
      name: "Waterskin",
      weight: 4,
      costGp: 1,
      quantity: 1,
      carryState: "carried",
    },
    {
      name: "Silk rope (50 ft)",
      weight: 5,
      costGp: 10,
      quantity: 1,
      carryState: "carried",
    },
    {
      name: "Bedroll and spare clothing",
      weight: 8,
      costGp: 6,
      quantity: 1,
      carryState: "cached",
      containerName: "Room at the Rusty Dragon",
    },
    {
      name: "Adventuring reserve",
      weight: 12,
      costGp: 25,
      quantity: 1,
      carryState: "cached",
      containerName: "Room at the Rusty Dragon",
    },
  ];
}
function base(
  name: string,
  ancestry: string,
  classNames: string[],
  scores: CharacterBuild["baseAbilityScores"],
  skills: SkillKey[],
  feats: string[][],
  increase: "str" | "dex" | "wis",
): CharacterBuild {
  const build: CharacterBuild = {
    name,
    race: race(ancestry),
    alignment: "neutral-good",
    baseAbilityScores: scores,
    favoredClassName: classNames[0],
    campaignRules: { firearmRules: "standard" },
    coinPurse: { pp: 15, gp: 375, sp: 24, cp: 8 },
    levels: [],
    equipment: gear(),
    weapons: [],
  };
  classNames.forEach((className, index) => {
    const definition = RUNTIME_CLASSES[className.toLowerCase()];
    if (!definition) throw new Error(`Missing review class: ${className}`);
    build.levels.push({
      className,
      hitPointRoll:
        index === 0 ? definition.hitDie : Math.floor(definition.hitDie / 2) + 1,
      favoredClass: className === build.favoredClassName ? "hp" : undefined,
      abilityIncrease: (index + 1) % 4 === 0 ? increase : undefined,
      feats: feats[index] ?? [],
      skillRanks: {},
    });
    const budget = skillPointBudgetForLevel(
      build,
      RUNTIME_CLASS_OPTIONS,
      index,
    );
    if (budget > skills.length)
      throw new Error(
        `Insufficient review skill choices for ${name}: ${budget}`,
      );
    build.levels[index]!.skillRanks = Object.fromEntries(
      skills.slice(0, budget).map((skill) => [skill, 1]),
    );
  });
  return build;
}
const eight = (className: string) => Array.from({ length: 8 }, () => className);
export function createReviewCharacters(): Array<{
  build: CharacterBuild;
  details: CharacterDetails;
}> {
  const fighter = base(
    "Mara Ironwood",
    "Human",
    eight("Fighter"),
    { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    ["climb", "swim", "intimidate"],
    [
      ["Power Attack", "Weapon Focus (Greatsword)"],
      ["Cleave"],
      ["Toughness"],
      ["Weapon Specialization (Greatsword)"],
      ["Iron Will"],
      ["Furious Focus"],
      ["Improved Initiative"],
      ["Improved Critical (Greatsword)"],
    ],
    "str",
  );
  fighter.race.choiceSelection!.bonusFeat = "Combat Reflexes";
  fighter.equipment!.push(
    weapon("Greatsword"),
    weapon("Javelin"),
    armor("Full plate"),
    magic("Belt of Giant Strength +2"),
    magic("Cloak of Resistance +2"),
    magic("Ring of Protection +1"),
  );
  fighter.languages = { additional: ["Dwarven"] };

  const rogue = base(
    "Nyx Willowshade",
    "Elf",
    eight("Rogue"),
    { str: 10, dex: 16, con: 14, int: 12, wis: 12, cha: 10 },
    [
      "stealth",
      "disable-device",
      "perception",
      "acrobatics",
      "sleight-of-hand",
      "escape-artist",
      "bluff",
      "use-magic-device",
      "linguistics",
      "sense-motive",
    ],
    [
      ["Point-Blank Shot"],
      [],
      ["Precise Shot"],
      [],
      ["Rapid Shot"],
      [],
      ["Deadly Aim"],
    ],
    "dex",
  );
  rogue.levels[1]!.features = ["Rogue Talent: Fast Stealth"];
  rogue.levels[3]!.features = ["Rogue Talent: Finesse Rogue"];
  rogue.levels[5]!.features = ["Rogue Talent: Stand Up"];
  rogue.levels[7]!.features = ["Rogue Talent: Surprise Attack"];
  rogue.equipment!.push(
    weapon("Shortbow"),
    weapon("Rapier"),
    armor("Leather"),
    magic("Belt of Incredible Dexterity +2"),
    magic("Cloak of Resistance +2"),
    magic("Ring of Protection +1"),
    {
      name: "Arrows",
      ammoType: "arrow",
      quantity: 40,
      weight: 0.15,
      costGp: 0.05,
      carryState: "carried",
    },
    {
      name: "Masterwork thieves' tools",
      quantity: 1,
      costGp: 100,
      weight: 2,
      carryState: "carried",
      equipped: true,
      modifiers: [
        {
          source: "Masterwork thieves' tools",
          target: "skill.disable-device",
          type: "circumstance",
          value: 2,
        },
      ],
    },
  );
  rogue.languages = {
    starting: ["Draconic", "Goblin"],
    learned: [
      "Dwarven",
      "Gnome",
      "Halfling",
      "Orc",
      "Sylvan",
      "Undercommon",
      "Celestial",
      "Infernal",
    ],
  };

  const caster = base(
    "Elian Dawnscribe",
    "Human",
    [
      "Cleric",
      "Wizard",
      "Cleric",
      "Wizard",
      "Cleric",
      "Wizard",
      "Cleric",
      "Wizard",
    ],
    { str: 10, dex: 12, con: 12, int: 14, wis: 16, cha: 13 },
    [
      "spellcraft",
      "knowledge.religion",
      "knowledge.arcana",
      "linguistics",
      "perception",
    ],
    [
      ["Selective Channeling"],
      [],
      ["Combat Casting"],
      [],
      ["Extend Spell"],
      [],
      ["Improved Initiative"],
    ],
    "wis",
  );
  caster.race.choiceSelection!.flexibleAbility = "wis";
  caster.race.choiceSelection!.bonusFeat = "Extra Channel";
  caster.equipment!.push(
    weapon("Quarterstaff"),
    weapon("Light crossbow"),
    magic("Headband of Vast Intelligence +2"),
    magic("Cloak of Resistance +2"),
    magic("Ring of Protection +1"),
    {
      name: "Bolts",
      ammoType: "bolt",
      quantity: 20,
      weight: 0.1,
      costGp: 0.1,
      carryState: "carried",
    },
    {
      name: "Spellbook",
      componentCategory: "spellbook",
      quantity: 1,
      weight: 3,
      costGp: 15,
      carryState: "carried",
    },
    {
      name: "Spell component pouch",
      componentCategory: "kit",
      quantity: 1,
      weight: 2,
      costGp: 5,
      carryState: "carried",
    },
    {
      name: "Silver holy symbol",
      componentCategory: "divine-focus",
      quantity: 1,
      weight: 1,
      costGp: 25,
      carryState: "carried",
    },
  );
  caster.languages = {
    starting: ["Celestial", "Draconic"],
    learned: [
      "Dwarven",
      "Elven",
      "Goblin",
      "Gnome",
      "Halfling",
      "Orc",
      "Sylvan",
      "Infernal",
    ],
  };
  caster.spellDomains = { cleric: ["war", "good"] };
  caster.spellLibrary = {
    cleric: {
      0: [
        "Create Water",
        "Detect Magic",
        "Guidance",
        "Light",
        "Read Magic",
        "Stabilize",
      ],
      1: [
        "Bless",
        "Cure Light Wounds",
        "Divine Favor",
        "Shield of Faith",
        "Magic Weapon",
        "Sanctuary",
        "Protection from Evil",
      ],
      2: [
        "Aid",
        "Cure Moderate Wounds",
        "Restoration, Lesser",
        "Resist Energy",
        "Bull's Strength",
        "Spiritual Weapon",
      ],
    },
    wizard: {
      0: [
        "Acid Splash",
        "Detect Magic",
        "Light",
        "Mage Hand",
        "Prestidigitation",
        "Read Magic",
      ],
      1: [
        "Mage Armor",
        "Shield",
        "Magic Missile",
        "Grease",
        "Enlarge Person",
        "Reduce Person",
        "Feather Fall",
        "Sleep",
        "Burning Hands",
      ],
      2: ["Mirror Image", "Invisibility", "Web", "Scorching Ray"],
    },
  };
  const sheet = computeSheet(
    buildCharacter(
      caster,
      RUNTIME_CLASSES,
      RUNTIME_FEATS,
      RUNTIME_CLASS_FEATURES,
      RUNTIME_ARCHETYPES,
    ),
    { spellRegistry: RUNTIME_SPELLS },
  );
  caster.spellSelections = {};
  for (const source of sheet.spellcasting) {
    const key = source.className.toLowerCase();
    const library = caster.spellLibrary[key] ?? {};
    caster.spellSelections[key] = {
      prepared: Object.fromEntries(
        Object.entries(source.preparedCapacity).map(([level, capacity]) => {
          const options = library[Number(level)] ?? [];
          return [
            level,
            Array.from(
              { length: capacity ?? 0 },
              (_, index) => options[index % options.length]!,
            ).filter(Boolean),
          ];
        }),
      ),
    };
  }

  const goblin = base(
    "Sir Sprocket Soupbane",
    "Goblin",
    eight("Barbarian"),
    { str: 18, dex: 12, con: 16, int: 10, wis: 10, cha: 8 },
    ["acrobatics", "climb", "perception", "survival"],
    [
      ["Power Attack"],
      [],
      ["Toughness"],
      [],
      ["Cleave"],
      [],
      ["Furious Focus"],
    ],
    "str",
  );
  goblin.alignment = "chaotic-good";
  goblin.levels[1]!.features = ["Rage Power: Guarded Stance"];
  goblin.levels[3]!.features = ["Rage Power: Superstition"];
  goblin.levels[5]!.features = ["Rage Power: Strength Surge"];
  goblin.levels[7]!.features = ["Rage Power: Increased Damage Reduction"];
  goblin.equipment!.push(
    weapon("Greatclub"),
    weapon("Javelin"),
    armor("Chain shirt"),
    magic("Belt of Giant Strength +2"),
    magic("Cloak of Resistance +2"),
    magic("Ring of Protection +1"),
    {
      name: "Ceremonial soup ladle",
      quantity: 1,
      weight: 1,
      costGp: 0.2,
      carryState: "carried",
    },
    {
      name: "Emergency victory confetti",
      quantity: 3,
      weight: 0,
      costGp: 0.1,
      carryState: "carried",
    },
  );
  goblin.languages = { additional: ["Common"] };

  const profiles = [
    {
      deity: "Iomedae",
      gender: "Woman",
      age: "34",
      height: "6 ft",
      weight: "185 lb",
      homeland: "Lastwall",
      associations: "The Ironwood Free Company",
    },
    {
      deity: "Desna",
      gender: "Woman",
      age: "127",
      height: "5 ft 10 in",
      weight: "125 lb",
      homeland: "Kyonin",
      associations: "The Lantern Couriers",
    },
    {
      deity: "Iomedae",
      gender: "Man",
      age: "41",
      height: "5 ft 11 in",
      weight: "160 lb",
      homeland: "Absalom",
      associations: "The Dawn Archive",
    },
    {
      deity: "Cayden Cailean",
      gender: "Goblin gentleman",
      age: "19",
      height: "3 ft 1 in",
      weight: "39 lb",
      homeland: "A suspiciously prestigious ditch",
      associations: "Most Noble Order of the Empty Bowl",
    },
  ];
  const playbooks = [
    "Front-line greatsword specialist. Test Power Attack, iterative attacks, armor speed, damage, healing, and Rest. Dwarven was learned from a GM-approved mentor. Her spare gear is stored at the inn.",
    "Ranged scout and trap specialist. Use Shortbow within sneak-attack range; the table adjudicates denied Dexterity and concealment. Test ammo consumption, Deadly Aim, skills, and the attack log. Rogue talents are recorded as level choices; conditional talent benefits remain table-adjudicated where the engine has no implementation.",
    "Cleric 4 / Wizard 4, advancing alternately. Prepare and cast each source separately; use Mage Armor instead of physical armor for arcane casting. Test reprepare, source filtering, spell details, channel uses, and Rest. The current catalog has simplified domain spell lists; confirm campaign domain choices before using this review character in play.",
    "A self-appointed knight who believes his greatclub is a sacred soup spoon. Test Small size, Rage and fatigue, shared ability counters, temporary HP, and Rest. Common is GM-granted. Rage powers are recorded as level choices; adjudicate unsupported conditional powers at the table. His solemn oath: No soup left behind.",
  ];
  return [fighter, rogue, caster, goblin].map((build, index) => ({
    build,
    details: {
      profile: profiles[index],
      notes: [
        {
          id: `review-playbook-${index}`,
          createdAt: "2026-09-09T12:00:00.000Z",
          title: "Review playbook",
          category: "General",
          pinned: true,
          body: playbooks[index]!,
        },
        {
          id: `review-origin-${index}`,
          createdAt: "2026-09-09T12:01:00.000Z",
          title: "An unlikely fellowship",
          category: "Origin",
          pinned: false,
          body: `${build.name} joined the party after a caravan rescue near Sandpoint. Their next lead is a stolen ledger at the Rusty Dragon. This level-8 character is a review sandbox, not tied to a campaign.`,
        },
        {
          id: `review-campaign-${index}`,
          createdAt: "2026-09-09T12:02:00.000Z",
          title: "The missing ledger",
          category: "Campaign",
          pinned: false,
          body: "Find the blue-sealed ledger. Question the dockmaster. Meet the courier after dusk. Supplies and spare clothing are stored in the party's room at the inn.",
        },
      ],
    },
  }));
}
