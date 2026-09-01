import { CORE_RACES } from "@mathfinder/rules-data";
import {
  SPELL_EFFECTS,
  equipmentWeaponTemplate,
  getWeapon,
  resolveSpellEffect,
  type CharacterBuild,
  type LevelEntry,
  type Modifier,
  type SpellEffectRuntimeContext,
} from "@mathfinder/rules-engine";

export const SAMPLE_RACES: Record<string, CharacterBuild["race"]> =
  Object.fromEntries(
    CORE_RACES.map((race) => [
      race.id,
      {
        name: race.name,
        size: race.size,
        speed: race.speed,
        abilityModifiers: race.abilityModifiers,
        traits: race.traits,
        classSkills: race.classSkills,
        weaponProficiencies: race.weaponProficiencies,
        specificWeaponProficiencies: race.specificWeaponProficiencies,
        weaponFamiliarity: race.weaponFamiliarity,
        grantedWeapons: race.grantedWeapons,
        choiceOptions: race.choiceOptions,
        alternateTraits: race.alternateTraits,
        movementModes: race.movementModes,
        senses: race.senses,
        resistances: race.resistances,
        notes: race.notes,
      },
    ]),
  );

const greataxeTemplate = getWeapon("greataxe");
const javelinTemplate = getWeapon("javelin");

/** Starting character: a fresh level-1 Half-Orc Barbarian. */
export const initialBuild: CharacterBuild = {
  name: "Grukk",
  race: {
    ...SAMPLE_RACES["half-orc"]!,
    id: "half-orc",
    choiceSelection: {
      flexibleAbility: "str",
    },
  },
  favoredClassName: "Barbarian",
  coinPurse: { pp: 0, gp: 12, sp: 5, cp: 0 },
  baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  levels: [
    {
      className: "Barbarian",
      hitPointRoll: 12,
      skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
      feats: ["Toughness"], // +3 HP auto-applied from the feat registry
      modifiers: [],
    },
  ],
  weapons: [
    ...(greataxeTemplate
      ? [
          {
            name: greataxeTemplate.name,
            ...equipmentWeaponTemplate(greataxeTemplate).weapon,
          },
        ]
      : []),
    ...(javelinTemplate
      ? [
          {
            name: javelinTemplate.name,
            ...equipmentWeaponTemplate(javelinTemplate).weapon,
          },
        ]
      : []),
  ],
  equipment: [
    { name: "Arrows", quantity: 20, weight: 3, costGp: 1, equipped: false },
    { name: "Bolts", quantity: 10, weight: 1, costGp: 1, equipped: false },
  ],
};

/** Template used by the "Level Up" button (a +7 HP Barbarian level). */
export const nextBarbarianLevel: Omit<LevelEntry, "hitPointRoll"> & {
  hitPointRoll: number;
} = {
  className: "Barbarian",
  hitPointRoll: 7,
  skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
};

/** Suggestions for the level-up feat picker (free-text is also allowed). */
export const SAMPLE_FEATS: string[] = [
  "Power Attack",
  "Cleave",
  "Weapon Focus",
  "Toughness",
  "Dodge",
  "Improved Initiative",
  "Iron Will",
  "Great Fortitude",
  "Lightning Reflexes",
  "Combat Reflexes",
  "Furious Focus",
  "Intimidating Prowess",
];

export interface Buff {
  id: string;
  name: string;
  description: string;
  modifiers: Modifier[];
  limitations?: string[];
  trackerLabel?: string;
  trackerMax?: number;
}

export function buildRuntimeBuffs(context: SpellEffectRuntimeContext): Buff[] {
  return SPELL_EFFECTS.map((effect) => {
    const resolved = resolveSpellEffect(effect, context);
    return {
      id: resolved.id,
      name: resolved.spellName,
      description: resolved.description,
      modifiers: resolved.modifiers,
      limitations: resolved.limitations,
      trackerLabel: resolved.tracker?.label,
      trackerMax: resolved.tracker?.max,
    } satisfies Buff;
  });
}
