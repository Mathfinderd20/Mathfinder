import type { TrapOptionDefinition } from "../../types";

const pack = "savage-company" as const;

export const SAVAGE_COMPANY_TRAPS: TrapOptionDefinition[] = [
  {
    id: "acid-trap",
    name: "Acid Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Splashes the triggering creature with acid for 1d6 + half ranger level acid damage; Reflex negates.",
    restrictions: ["Requires a dose of acid."],
  },
  {
    id: "alarm-trap",
    name: "Alarm Trap",
    pack,
    category: "ranger-trap-modifier",
    description: "Creates a loud audible-alarm style warning when triggered.",
  },
  {
    id: "blight-trap",
    name: "Blight Trap",
    pack,
    category: "ranger-trap",
    description:
      "Marks the victim with blighted matter, penalizing AC and saves against blight-affiliated creatures for 10 minutes per level; Will negates.",
  },
  {
    id: "burning-trap",
    name: "Burning Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Added to a fire or grenade trap; failed Reflex save also sets the victim on fire for 1d4 rounds.",
    restrictions: ["Only modifies fire or grenade traps."],
  },
  {
    id: "blightburn-trap",
    name: "Blightburn Trap",
    pack,
    category: "ranger-trap",
    description:
      "Deals fire damage plus Constitution and Charisma damage; Fortitude halves fire and negates ability damage.",
    restrictions: ["Requires a sliver of blightburn."],
  },
  {
    id: "bludgeoning-trap",
    name: "Bludgeoning Trap",
    pack,
    category: "ranger-trap",
    description:
      "Makes a level-scaled bludgeoning attack against the trigger target using the ranger’s level and Wisdom.",
  },
  {
    id: "channeled-energy-trap",
    name: "Channeled Energy Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Channels positive or negative energy to damage undead or living creatures respectively for 1d8 + level; Will half.",
    restrictions: ["Requires holy water or unholy water."],
  },
  {
    id: "cleansing-trap",
    name: "Cleansing Trap",
    pack,
    category: "ranger-trap",
    description:
      "Suppresses one random poison- or disease-delivering attack, ability, or quality on the target for 1 round per ranger level.",
  },
  {
    id: "dummy-trap",
    name: "Dummy Trap",
    pack,
    category: "ranger-trap",
    description:
      "Creates a fleeing or moving humanoid decoy that can misdirect observers until closely inspected.",
  },
  {
    id: "dirty-trick-trap",
    name: "Dirty Trick Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Adds a dirty trick combat maneuver attempt using ranger level + Wisdom modifier as CMB.",
  },
  {
    id: "distraction-trap",
    name: "Distraction Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Applies a –2 penalty to Perception, initiative, and Reflex saves for 10 minutes per level.",
    restrictions: ["Requires itching powder or similar alchemical irritant."],
  },
  {
    id: "exploding-trap",
    name: "Exploding Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Makes a fire or grenade trap burst into adjacent squares for extra fire damage; Reflex negates.",
    restrictions: ["Only modifies fire or grenade traps."],
  },
  {
    id: "fire-trap",
    name: "Fire Trap",
    pack,
    category: "ranger-trap",
    description:
      "Explodes in flame for 1d6 + half ranger level fire damage to the triggering creature; Reflex negates.",
    restrictions: ["Requires alchemist’s fire or similar explosive."],
  },
  {
    id: "firework-trap",
    name: "Firework Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Explodes in colorful light and can blind creatures within 10 feet for 1d4+1 rounds; Fortitude negates.",
    restrictions: ["Only modifies fire, smoke, or grenade traps."],
  },
  {
    id: "freezing-trap",
    name: "Freezing Trap",
    pack,
    category: "ranger-trap",
    description:
      "Deals cold damage and entangles the target in ice like a tanglefoot bag; Reflex halves damage and avoids getting stuck.",
  },
  {
    id: "grenade-trap",
    name: "Grenade Trap",
    pack,
    category: "ranger-trap",
    description:
      "Detonates an installed grenade; successful Reflex save halves damage when the grenade normally deals damage.",
    restrictions: [
      "Requires a grenade to set, but it can be recovered if safely disarmed first.",
    ],
  },
  {
    id: "infected-snare-trap",
    name: "Infected Snare Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "A diseased snare that deals Constitution damage immediately and hourly thereafter until the target resists twice in a row or 12 hours pass.",
    restrictions: ["Only modifies snare traps."],
  },
  {
    id: "lazurite-trap",
    name: "Lazurite Trap",
    pack,
    category: "ranger-trap",
    description:
      "Bathes the target in lazurite radiation, penalizing AC and saves against undead for 10 minutes per level; Will negates.",
    restrictions: ["Requires a sliver of lazurite."],
  },
  {
    id: "limning-trap",
    name: "Limning Trap",
    pack,
    category: "ranger-trap",
    description:
      "Covers targets in glowing dust, outlining invisible creatures and inflicting a –20 Stealth penalty for rounds per level.",
  },
  {
    id: "marking-trap",
    name: "Marking Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Marks a failed target with scent or dye, making scent tracking easier by 4 and leaving evidence for days.",
  },
  {
    id: "oversized-barbs",
    name: "Oversized Barbs",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Implants painful barbs that hinder Climb, Swim, and squeezing until removed or they shake loose.",
  },
  {
    id: "penetrating-trap",
    name: "Penetrating Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Improves a wounding trap to 1d8 damage and lets it count as adamantine, cold iron, or silver.",
    restrictions: [
      "Only modifies wounding traps and requires 1 pound of the chosen material.",
    ],
  },
  {
    id: "pit-trap",
    name: "Pit Trap",
    pack,
    category: "ranger-trap",
    description:
      "A concealed pit 5 feet deep plus 5 feet per 4 ranger levels; Reflex avoids falling in.",
  },
  {
    id: "poison-trap",
    name: "Poison Trap",
    pack,
    category: "ranger-trap",
    description:
      "Applies a supplied contact, inhaled, or injury poison to the triggering creature.",
    restrictions: ["Requires 1 dose of poison."],
  },
  {
    id: "rust-monster-trap",
    name: "Rust Monster Trap",
    pack,
    category: "ranger-trap",
    description:
      "Throws rust monster dust to damage metal armor and weapons, with extra damage available by spending more daily trap uses.",
  },
  {
    id: "smoke-trap",
    name: "Smoke Trap",
    pack,
    category: "ranger-trap",
    description:
      "Creates thick choking smoke that blocks all sight and penalizes Strength and Dexterity every round; Fortitude resists the penalties.",
  },
  {
    id: "snare-trap",
    name: "Snare Trap",
    pack,
    category: "ranger-trap",
    description:
      "Immobilizes a creature in place or on a leash until escaped, broken, or cut free.",
  },
  {
    id: "swarm-trap",
    name: "Swarm Trap",
    pack,
    category: "ranger-trap",
    description:
      "Releases a bat, rat, or spider swarm that menaces the area for up to 1 round per ranger level.",
    restrictions: [
      "Requires the physical swarm creatures to be provided and kept alive.",
    ],
  },
  {
    id: "tar-trap",
    name: "Tar Trap",
    pack,
    category: "ranger-trap",
    description:
      "Entangles the target in sticky tar and makes it vulnerable to intense ignition for extra fire damage.",
    restrictions: ["Requires a dose of tar."],
  },
  {
    id: "toxic-fumes-trap",
    name: "Toxic Fumes Trap",
    pack,
    category: "ranger-trap-modifier",
    description:
      "Upgrades a smoke trap so creatures also risk becoming nauseated in and shortly after the smoke.",
    restrictions: ["Only modifies smoke traps."],
  },
  {
    id: "tripwire",
    name: "Tripwire",
    pack,
    category: "ranger-trap",
    description:
      "Knocks the target prone unless it succeeds on a Reflex save; charging or running creatures take a –6 penalty to the save.",
  },
  {
    id: "wounding-trap",
    name: "Wounding Trap",
    pack,
    category: "ranger-trap",
    description:
      "Makes a melee attack using the ranger’s base attack bonus and Wisdom modifier, dealing 1d6 + half ranger level damage of a chosen physical type.",
  },
];
