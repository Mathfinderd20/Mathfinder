import type { ArchetypeDefinition } from "../../types";

const PACK = "savage-company" as const;

export const SAVAGE_COMPANY_ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: "combat-medic",
    name: "Combat Medic",
    pack: PACK,
    baseClassName: "Alchemist",
    description:
      "A battlefield alchemist who trades poison-focused class features for front-line proficiencies and staying power.",
    replaces: [
      "weapon and armor proficiency",
      "poison resistance",
      "poison immunity",
      "poison use",
      "swift poisoning",
    ],
    features: [
      {
        level: 1,
        name: "Weapon and Armor Proficiency",
        summary:
          "Gain simple and martial weapons, firearms, bombs, and light/medium armor proficiency.",
      },
      {
        level: 2,
        name: "Last Man Standing",
        summary: "Gain Endurance and Diehard as bonus feats.",
      },
    ],
  },
  {
    id: "craftwright",
    name: "Craftwright",
    pack: PACK,
    baseClassName: "Alchemist",
    description:
      "An item-and-construct-focused alchemist who leans into crafting rather than mutagens or thrown offense.",
    replaces: ["mutagen", "throw anything", "poison use", "swift poisoning"],
    features: [
      {
        level: 3,
        name: "Alchemical Craftsman",
        summary: "Gain Master Craftsman using Craft (alchemy) to qualify.",
      },
      {
        level: 5,
        name: "Construct Craftsman",
        summary:
          "Gain Craft Construct and treat craftwright level as caster level for creating constructs.",
      },
      {
        level: 7,
        name: "Preserve Essence",
        summary:
          "Salvage 50% of a destroyed magic item’s gp value and its crafting spells for a new item begun within 24 hours.",
      },
    ],
  },
  {
    id: "bugler",
    name: "Bugler",
    pack: PACK,
    baseClassName: "Bard",
    description:
      "A military signaler bard whose performances focus on readiness, marching, morale, and battlefield control.",
    replaces: [
      "lore master",
      "distraction",
      "fascinate",
      "suggestion",
      "dirge of doom",
      "frightening tune",
      "mass suggestion",
      "deadly performance",
    ],
    alters: ["bardic performance"],
    features: [
      {
        level: 1,
        name: "Reveille",
        summary:
          "Wake allies and help them resist or shake off sleep, stun, paralysis, and similar effects.",
      },
      {
        level: 1,
        name: "Boots and Saddles",
        summary:
          "Temporarily ignore or later remove fatigue-, fear-, and nausea-style conditions from allies who can hear you.",
      },
      {
        level: 6,
        name: "Guard Mounting",
        summary: "Grant allies dodge AC and Perception bonuses.",
      },
      {
        level: 8,
        name: "Cadence",
        summary:
          "Lead a force march without Constitution checks or nonlethal damage.",
      },
      {
        level: 14,
        name: "Taps",
        summary:
          "Restore hit points and emulate breath of life on a recently slain nearby ally.",
      },
      {
        level: 18,
        name: "Heroic Charge",
        summary:
          "Let nearby allies charge as an immediate action once per day.",
      },
      {
        level: 20,
        name: "Tattoo Call",
        summary:
          "Emulate deathless, anchoring allies against death from hit point loss while the performance continues.",
      },
    ],
  },
  {
    id: "operator",
    name: "Operator",
    pack: PACK,
    baseClassName: "Brawler",
    description:
      "A commando-style brawler who blends close-quarters fighting, firearms, grit, and weapon flexibility.",
    replaces: [
      "brawler's cunning",
      "maneuver training",
      "close weapon mastery",
      "awesome blow",
      "improved awesome blow",
    ],
    modifies: ["weapon and armor proficiency", "brawler's flurry"],
    features: [
      {
        level: 1,
        name: "Grit Training",
        summary:
          "Gain gunslinger-style grit and scalable deed selection keyed to operator level.",
      },
      {
        level: 2,
        name: "Operator's Flurry",
        summary:
          "Use a two-weapon-style flurry with unarmed strikes, close fighter weapons, and firearms.",
      },
      {
        level: 5,
        name: "Gun Training",
        summary:
          "Select firearm types and add Dexterity to damage with them, expanding to more firearm types over time.",
      },
      {
        level: 20,
        name: "Weapons Master",
        summary:
          "Use operator’s flurry with all martial weapons and add Dexterity to damage with any ranged weapon.",
      },
    ],
  },
  {
    id: "driver",
    name: "Driver",
    pack: PACK,
    baseClassName: "Cavalier",
    description:
      "A cavalry commander reimagined around vehicles instead of animals, with a customizable vehicle mount.",
    replaces: ["weapon and armor proficiencies", "mount", "expert trainer"],
    alters: ["class skills"],
    features: [
      {
        level: 1,
        name: "Vehicle Mount",
        summary:
          "Bond with a chosen vehicle that gains mount-like scaling statistics and benefits.",
      },
      {
        level: 1,
        name: "Efficient Repair",
        summary: "Repair your vehicle mount in half the normal time and cost.",
      },
      {
        level: 3,
        name: "Evasion",
        summary: "Vehicle mount gains evasion from its scaling table.",
      },
      {
        level: 6,
        name: "Magic Propulsion",
        summary:
          "Vehicle no longer needs fuel and automatically succeeds at Ride checks to maneuver.",
      },
      {
        level: 15,
        name: "Improved Evasion",
        summary: "Vehicle mount gains improved evasion from its scaling table.",
      },
    ],
  },
  {
    id: "battle-chaplain",
    name: "Battle Chaplain",
    pack: PACK,
    baseClassName: "Cleric",
    description:
      "A combat-healer cleric who locks into positive-channel support and trades domains for martial weapon training.",
    replaces: ["weapon and armor proficiencies", "domains"],
    alters: ["channel energy"],
    features: [
      {
        level: 1,
        name: "Healing Channeler",
        summary:
          "Must channel positive energy, cannot harm undead with it, and heals living creatures for 50% more.",
      },
      {
        level: 5,
        name: "Weapon Training",
        summary: "Gain fighter-style weapon training progression.",
      },
      {
        level: 10,
        name: "Battle Grace",
        summary:
          "Add half Wisdom modifier as a sacred bonus to attack and damage rolls.",
      },
    ],
  },
  {
    id: "sophic",
    name: "Sophic",
    pack: PACK,
    baseClassName: "Fighter",
    description:
      "A mystic armory fighter who summons idealized weapons, armor, and shields from an akashic arsenal.",
    replaces: [
      "bravery",
      "bonus feat (6th)",
      "bonus feat (12th)",
      "bonus feat (16th)",
    ],
    alters: ["class skills"],
    features: [
      {
        level: 1,
        name: "Akashic Armory",
        summary:
          "Swiftly summon masterwork gear you are proficient with; summoned gear scales up to +4 enhancement over time.",
      },
      {
        level: 6,
        name: "Akashic Gate",
        summary:
          "Replace one attack by summoning and hurling a thrown weapon at great speed.",
      },
      {
        level: 12,
        name: "Akashic Bombardment",
        summary:
          "Blast a 30-foot cone of weapon-shards for level-scaled damage.",
      },
      {
        level: 16,
        name: "Akashic Vestments",
        summary:
          "Summon specific magic armor, weapons, or shields under a gp-per-level cap.",
      },
    ],
  },
  {
    id: "zen-gunman",
    name: "Zen Gunman",
    pack: PACK,
    baseClassName: "Monk",
    description:
      "A firearm-focused monk who converts core monk combat features into accurate, ki-enhanced gunplay.",
    replaces: [
      "stunning fist",
      "evasion",
      "maneuver training",
      "still mind",
      "purity of body",
      "improved evasion",
      "diamond body",
      "tongue of the sun and moon",
    ],
    alters: [
      "weapon and armor proficiency",
      "flurry of blows",
      "bonus feats",
      "ki pool",
    ],
    features: [
      {
        level: 1,
        name: "Flurry of Blows",
        summary:
          "Use flurry with firearms instead of unarmed strikes or monk weapons.",
      },
      {
        level: 1,
        name: "Perfect Strike",
        summary:
          "Gain Perfect Strike for firearms and later improve it to three rolls, taking the best.",
      },
      {
        level: 2,
        name: "Way of the Gun",
        summary:
          "Gain Weapon Focus and later Weapon Specialization with one firearm type.",
      },
      {
        level: 3,
        name: "Zen Gun Mastery",
        summary: "Use Wisdom instead of Dexterity on firearm attack rolls.",
      },
      {
        level: 3,
        name: "Point Blank Master",
        summary: "Gain Point Blank Master as a bonus feat.",
      },
      {
        level: 5,
        name: "Ki Bullets",
        summary:
          "Spend ki to upgrade bullet damage dice to your unarmed-strike damage.",
      },
      {
        level: 9,
        name: "Reflexive Shot",
        summary: "Make attacks of opportunity with bullets from your firearm.",
      },
      {
        level: 11,
        name: "Trick Shot",
        summary:
          "Spend ki to ignore concealment, cover, and eventually total cover for a round.",
      },
      {
        level: 17,
        name: "Ki Focus Firearm",
        summary: "Treat fired bullets as ki focus weapons while you retain ki.",
      },
    ],
  },
  {
    id: "steel-saint",
    name: "Steel Saint",
    pack: PACK,
    baseClassName: "Paladin",
    description:
      "A gun-paladin who radiates smiting power across an area and binds divine power to a firearm instead of a shield or mount package.",
    replaces: ["smite evil", "divine bond"],
    alters: ["weapon and armor proficiencies", "mercy"],
    features: [
      {
        level: 1,
        name: "Smite Aura",
        summary:
          "Activate a 30-foot aura that boosts attacks, damage, DR-bypass, and AC against evil creatures within it.",
      },
      {
        level: 3,
        name: "Merciful Clear",
        summary:
          "Add a mercy that clears the broken condition from a firearm misfired by the target.",
      },
      {
        level: 5,
        name: "Divine Bond",
        summary:
          "Bond only with a firearm; supports paired identical firearms and adds ranged-friendly enhancements like distance and reliable.",
      },
    ],
  },
  {
    id: "roughneck-ranger",
    name: "Roughneck Ranger",
    pack: PACK,
    baseClassName: "Ranger",
    description:
      "A deep-field guerrilla ranger who trades spellcasting for traps, alchemical support, and a mandatory animal companion bond.",
    replaces: ["wild empathy", "spells"],
    alters: ["class skills", "weapon and armor proficiency", "hunter's bond"],
    features: [
      {
        level: 1,
        name: "Alchemical Aptitude",
        summary:
          "Add half level to Craft (alchemy) for gear, equipment, and explosives.",
      },
      {
        level: 1,
        name: "Companion's Bond",
        summary: "Must choose an animal companion for hunter’s bond.",
      },
      {
        level: 1,
        name: "Trapfinding",
        summary:
          "Gain half-level bonuses to find and disable traps and can disable magic traps.",
      },
      {
        level: 5,
        name: "Traps",
        summary:
          "Gain trap uses per day and learn extraordinary roughneck ranger traps instead of spells.",
      },
      {
        level: 10,
        name: "Demolition Bomb",
        summary:
          "Gain demolition bomb as the alchemical sapper ability, using ranger level for damage.",
      },
    ],
    notes: [
      "The archetype includes a large bespoke trap list; model that as future trap-option content rather than inlining each trap into the archetype schema.",
    ],
  },
  {
    id: "phantom-warrior",
    name: "Phantom Warrior",
    pack: PACK,
    baseClassName: "Spiritualist",
    description:
      "A martial spiritualist whose phantom becomes a resolute combat partner and who trades spellcasting for fighter-style weapon progression.",
    replaces: ["spellcasting", "empowered consciousness"],
    modifies: ["weapon and armor proficiency", "phantom", "etheric tether"],
    features: [
      {
        level: 1,
        name: "Resolute Phantom",
        summary:
          "Must choose the new resolute emotional focus; phantom gains full-BAB progression and combat-delivery changes.",
      },
      {
        level: 1,
        name: "Dual Tether",
        summary:
          "Host and phantom may freely transfer hit points between each other to prevent banishment, death, or unconsciousness.",
      },
      {
        level: 5,
        name: "Weapon Training",
        summary: "Gain fighter-style weapon training progression.",
      },
      {
        level: 20,
        name: "Potent Phantom",
        summary: "Phantom gains a second emotional focus.",
      },
    ],
    notes: [
      "Savage Company also defines the new resolute phantom emotional focus; that should eventually become a separate spiritualist-option content type.",
    ],
  },
  {
    id: "blitzkrieg",
    name: "Blitzkrieg",
    pack: PACK,
    baseClassName: "Unchained Barbarian",
    description:
      "A firearm-mad barbarian who retools rage around guns, dual-wielding, and absurd volume of fire.",
    replaces: [
      "uncanny dodge",
      "danger sense",
      "improved uncanny dodge",
      "indomitable will",
    ],
    modifies: [
      "weapon and armor proficiencies",
      "rage",
      "greater rage",
      "mighty rage",
    ],
    features: [
      {
        level: 1,
        name: "Gun Rage",
        summary:
          "Rage boosts firearm attack and damage, firearm-compatible rage powers, Will saves, and temporary hit points.",
      },
      {
        level: 2,
        name: "Barrel Bludgeon",
        summary:
          "Use firearms as bludgeoning melee weapons with firearm enhancement bonuses.",
      },
      {
        level: 3,
        name: "MORE GUNS",
        summary:
          "Wield a two-handed firearm in one hand with an attack penalty.",
      },
      {
        level: 5,
        name: "Twin-Linked",
        summary:
          "Strap identical firearms together to fire both at once for extra attacks and ammo consumption.",
      },
      {
        level: 14,
        name: "Rain of Hate",
        summary:
          "While raging, firearms auto-reload from carried ammo and ignore jams and misfires.",
      },
    ],
  },
  {
    id: "covert-infiltrator",
    name: "Covert Infiltrator",
    pack: PACK,
    baseClassName: "Unchained Rogue",
    description:
      "A spycraft rogue focused on disguise, forgery, knowledge access, and controlled assassination rather than raw combat optimization.",
    replaces: [
      "evasion",
      "debilitating injury",
      "finesse training",
      "rogue talent (6th)",
    ],
    modifies: ["class skills", "weapon and armor proficiency"],
    features: [
      {
        level: 1,
        name: "Intel",
        summary:
          "Add half level to all Knowledge checks and to Linguistics for forgery work; all Knowledge checks become usable untrained.",
      },
      {
        level: 4,
        name: "Master of Disguise",
        summary:
          "Disguise quickly, take 10 on Bluff/Disguise, and occasionally take 20 on them.",
      },
      {
        level: 5,
        name: "Signature Weapon",
        summary:
          "Gain Weapon Finesse and choose a firearm or finesse-able melee weapon for Dexterity-based damage benefits.",
      },
      {
        level: 6,
        name: "Versatile Bluff",
        summary:
          "Use Bluff to smooth over failed Stealth detection or stop deeper forgery inspection.",
      },
    ],
  },
  {
    id: "skirmish-marauder",
    name: "Skirmish Marauder",
    pack: PACK,
    baseClassName: "Unchained Rogue",
    description:
      "A battlefield rogue who swaps finesse training for broader martial proficiency and fighter-style weapon training.",
    replaces: ["weapon and armor proficiencies", "finesse training"],
    features: [
      {
        level: 5,
        name: "Weapon Training",
        summary:
          "Gain fighter-style weapon training progression, including attack, damage, and maneuver benefits.",
      },
    ],
  },
  {
    id: "dominus",
    name: "Dominus",
    pack: PACK,
    baseClassName: "Unchained Summoner",
    description:
      "A summoner bonded to a machine spirit, trading normal eidolon flexibility for a giant built-in artillery warmachine.",
    replaces: ["summon monster I"],
    alters: ["weapon and armor proficiencies", "eidolon"],
    features: [
      {
        level: 1,
        name: "Warmachine Eidolon",
        summary:
          "Must use the unique warmachine subtype; gets half evolution points but several free scaling upgrades.",
      },
      {
        level: 1,
        name: "Warmachine Subtype",
        summary:
          "Construct-outsider hybrid eidolon with manifested cannon attacks, no Constitution score, and vehicle-like upgrade flavor.",
      },
      {
        level: 4,
        name: "Energy Cannons",
        summary: "Warmachine cannons gain energy attacks.",
      },
      {
        level: 8,
        name: "Large Mount",
        summary:
          "Warmachine becomes Large, gains mount, and cannon damage increases.",
      },
      {
        level: 12,
        name: "Automatic Cannons",
        summary:
          "Gain DR 5/adamantine and automatic weapon quality on cannons.",
      },
      {
        level: 18,
        name: "Speed Cannons",
        summary: "Cannons increase again and gain an extra speed-like attack.",
      },
    ],
    notes: [
      "Savage Company includes a unique warmachine eidolon subtype; that should eventually become a dedicated summoner-option content type.",
    ],
  },
  {
    id: "retribution",
    name: "Retribution",
    pack: PACK,
    baseClassName: "Warpriest",
    description:
      "A siege-minded warpriest who blesses artillery crews and gains feats for heavy-engineering warfare.",
    alters: ["weapon and armor proficiencies", "blessings"],
    replaces: ["bonus feat (3rd)", "bonus feat (9th)"],
    features: [
      {
        level: 1,
        name: "Crusade Blessing",
        summary:
          "Gain the new crusade blessing in addition to one deity-based blessing.",
      },
      {
        level: 1,
        name: "Targeted Retribution",
        summary:
          "Deal extra precision damage to one creature within an area targeted by your firearm or siege engine attack.",
      },
      {
        level: 3,
        name: "Siege Engineer",
        summary: "Gain Siege Engineer as a bonus feat without prerequisites.",
      },
      {
        level: 9,
        name: "Master Siege Engineer",
        summary:
          "Gain Master Siege Engineer as a bonus feat without prerequisites.",
      },
      {
        level: 10,
        name: "Hands of the Legion",
        summary:
          "Empower a crew to assemble and disassemble siege engines with massive efficiency for a day.",
      },
    ],
  },
  {
    id: "apocalypse-witch",
    name: "Apocalypse Witch",
    pack: PACK,
    baseClassName: "Witch",
    description:
      "A destruction-loving witch who converts spell resources and magic items into brutal direct-damage blasts.",
    replaces: ["hex (2nd)", "hex (6th)", "major hex (10th)"],
    features: [
      {
        level: 2,
        name: "Burn Magic",
        summary:
          "Consume spells, scrolls, or item charges to make a close-range ranged touch blast for fire-and-force damage.",
      },
      {
        level: 6,
        name: "Explode Magic",
        summary: "Use Burn Magic as a fireball-like area blast.",
      },
      {
        level: 10,
        name: "Desolate Magic",
        summary:
          "Use Burn Magic as a cone that also dazes damaged creatures for 1 round.",
      },
    ],
    notes: [
      "The book also presents extra witch hex options alongside this archetype: Friendly Fire, Light Strike, Etched Bullets, and Gunsmith.",
    ],
  },
  {
    id: "hexslinger",
    name: "Hexslinger",
    pack: PACK,
    baseClassName: "Witch",
    description:
      "A gun-witch whose familiar is bound into a chosen firearm and empowered through a magus-like arcane pool.",
    replaces: ["familiar", "hex (1st)", "hex (4th)"],
    features: [
      {
        level: 1,
        name: "Firearm Familiar",
        summary:
          "Choose a blunderbuss, musket, or pistol as a familiar-bound patron conduit and maintain it to prepare spells.",
      },
      {
        level: 1,
        name: "Arcane Pool",
        summary:
          "Spend pool points to enhance the firearm familiar with scaling enhancement bonuses.",
      },
      {
        level: 6,
        name: "Firearm Properties",
        summary:
          "Spend enhancement budget on flaming, frost, reliable, speed, and similar weapon properties.",
      },
    ],
  },
];
