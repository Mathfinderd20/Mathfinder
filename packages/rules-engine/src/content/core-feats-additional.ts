import type { FeatDefinition } from "./feats";

function skillBonus(
  name: string,
  ...skills: string[]
): FeatDefinition["effects"] {
  return skills.map((skill) => ({
    target: `skill.${skill}`,
    type: "untyped",
    value: 2,
    source: name,
  }));
}

/**
 * Conservative Core Rulebook coverage that is commonly needed during
 * character creation. Feats whose full behavior needs richer runtime models
 * intentionally carry rules text without pretending to automate the effect.
 */
export const ADDITIONAL_CORE_FEATS: FeatDefinition[] = [
  {
    id: "acrobatic",
    name: "Acrobatic",
    pack: "core",
    description: "You get a +2 bonus on Acrobatics and Fly skill checks.",
    prerequisites: [],
    effects: skillBonus("Acrobatic", "acrobatics", "fly"),
  },
  {
    id: "alignment-channel",
    name: "Alignment Channel",
    pack: "core",
    description:
      "Choose an alignment; you can channel divine energy to affect outsiders with that alignment subtype.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "athletic",
    name: "Athletic",
    pack: "core",
    description: "You get a +2 bonus on Climb and Swim skill checks.",
    prerequisites: [],
    effects: skillBonus("Athletic", "climb", "swim"),
  },
  {
    id: "augment-summoning",
    name: "Augment Summoning",
    pack: "core",
    description:
      "Creatures you summon gain a +4 enhancement bonus to Strength and Constitution.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "combat-casting",
    name: "Combat Casting",
    pack: "core",
    description:
      "You get a +4 bonus on concentration checks made to cast defensively or while grappled.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "deceitful",
    name: "Deceitful",
    pack: "core",
    description: "You get a +2 bonus on Bluff and Disguise skill checks.",
    prerequisites: [],
    effects: skillBonus("Deceitful", "bluff", "disguise"),
  },
  {
    id: "deft-hands",
    name: "Deft Hands",
    pack: "core",
    description:
      "You get a +2 bonus on Disable Device and Sleight of Hand skill checks.",
    prerequisites: [],
    effects: skillBonus("Deft Hands", "disable-device", "sleight-of-hand"),
  },
  {
    id: "extra-channel",
    name: "Extra Channel",
    pack: "core",
    description: "You can channel energy two additional times per day.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "extra-ki",
    name: "Extra Ki",
    pack: "core",
    description: "Your ki pool increases by 2 points.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "extra-lay-on-hands",
    name: "Extra Lay On Hands",
    pack: "core",
    description: "You can use lay on hands two additional times per day.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "extra-mercy",
    name: "Extra Mercy",
    pack: "core",
    description: "Your lay on hands ability gains one additional mercy.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "greater-spell-focus",
    name: "Greater Spell Focus",
    pack: "core",
    description:
      "Choose a school of magic; the save DC of spells from that school increases by 1.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "greater-spell-penetration",
    name: "Greater Spell Penetration",
    pack: "core",
    description:
      "You get a +2 bonus on caster level checks made to overcome spell resistance.",
    prerequisites: [
      {
        type: "feat",
        featName: "Spell Penetration",
        description: "Spell Penetration",
      },
    ],
    effects: [],
  },
  {
    id: "improved-channel",
    name: "Improved Channel",
    pack: "core",
    description: "The save DC of your channel energy ability increases by 2.",
    prerequisites: [
      { type: "ability", ability: "cha", min: 13, description: "Cha 13" },
    ],
    effects: [],
  },
  {
    id: "improved-counterspell",
    name: "Improved Counterspell",
    pack: "core",
    description:
      "You can counterspell with a spell of the same school that is one or more spell levels higher.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "improved-familiar",
    name: "Improved Familiar",
    pack: "core",
    description: "You can acquire a more powerful familiar.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "improved-iron-will",
    name: "Improved Iron Will",
    pack: "core",
    description: "Once per day, you may reroll a Will save.",
    prerequisites: [
      { type: "feat", featName: "Iron Will", description: "Iron Will" },
    ],
    effects: [],
  },
  {
    id: "improved-lightning-reflexes",
    name: "Improved Lightning Reflexes",
    pack: "core",
    description: "Once per day, you may reroll a Reflex save.",
    prerequisites: [
      {
        type: "feat",
        featName: "Lightning Reflexes",
        description: "Lightning Reflexes",
      },
    ],
    effects: [],
  },
  {
    id: "magical-aptitude",
    name: "Magical Aptitude",
    pack: "core",
    description:
      "You get a +2 bonus on Spellcraft and Use Magic Device skill checks.",
    prerequisites: [],
    effects: skillBonus("Magical Aptitude", "spellcraft", "use-magic-device"),
  },
  {
    id: "natural-spell",
    name: "Natural Spell",
    pack: "core",
    description: "You can complete spell components while using wild shape.",
    prerequisites: [
      { type: "ability", ability: "wis", min: 13, description: "Wis 13" },
    ],
    effects: [],
  },
  {
    id: "nimble-moves",
    name: "Nimble Moves",
    pack: "core",
    description:
      "You can move through 5 feet of difficult terrain each round without additional movement cost.",
    prerequisites: [
      { type: "ability", ability: "dex", min: 13, description: "Dex 13" },
    ],
    effects: [],
  },
  {
    id: "run",
    name: "Run",
    pack: "core",
    description:
      "You run faster and retain your Dexterity bonus to AC while running.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "self-sufficient",
    name: "Self-Sufficient",
    pack: "core",
    description: "You get a +2 bonus on Heal and Survival skill checks.",
    prerequisites: [],
    effects: skillBonus("Self-Sufficient", "heal", "survival"),
  },
  {
    id: "spell-mastery",
    name: "Spell Mastery",
    pack: "core",
    description:
      "Choose a number of wizard spells equal to your Intelligence modifier; you can prepare them without a spellbook.",
    prerequisites: [],
    effects: [],
  },
];
