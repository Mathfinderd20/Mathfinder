import type {
  AbilityKey,
  Alignment,
  CharacterBuild,
  SkillKey,
} from "@mathfinder/rules-engine";

interface FreshCharacterChoices {
  className: string;
  alignment: Alignment;
  hitPointRoll: number;
  baseAbilityScores: Record<AbilityKey, number>;
  flexibleAbility?: AbilityKey;
  raceBonusFeat?: string;
  skillRanks?: Partial<Record<SkillKey, number>>;
  feats?: string[];
  favoredClass?: string;
}

export function createFreshCharacterBuild(
  name: string,
  race: CharacterBuild["race"],
  choices: FreshCharacterChoices,
): CharacterBuild {
  const className = choices.className.trim();
  return {
    name: name.trim() || "Unnamed Hero",
    alignment: choices.alignment,
    race: {
      ...race,
      choiceSelection: {
        flexibleAbility: choices.flexibleAbility,
        bonusFeat: choices.raceBonusFeat?.trim() || undefined,
        alternateTraits: [],
      },
    },
    favoredClassName: className,
    baseAbilityScores: choices.baseAbilityScores,
    levels: [
      {
        className,
        hitPointRoll: Math.max(1, choices.hitPointRoll),
        skillRanks: choices.skillRanks ?? {},
        feats: choices.feats ?? [],
        favoredClass: choices.favoredClass,
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
