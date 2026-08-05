import type { CharacterBuild } from "@mathfinder/rules-engine";

export function createFreshCharacterBuild(
  name: string,
  humanRace: CharacterBuild["race"],
): CharacterBuild {
  return {
    name: name.trim() || "Unnamed Hero",
    race: {
      ...humanRace,
      choiceSelection: {
        flexibleAbility: "str",
        alternateTraits: [],
      },
    },
    favoredClassName: "Fighter",
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: [
      {
        className: "Fighter",
        hitPointRoll: 10,
        skillRanks: {},
        feats: [],
        modifiers: [],
      },
    ],
    campaignRules: { firearmRules: "standard" },
    coinPurse: { pp: 0, gp: 0, sp: 0, cp: 0 },
    weapons: [],
    equipment: [],
    carriedWeight: 0,
  };
}
